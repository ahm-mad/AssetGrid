/**
 * ETL orchestrator.
 *
 *   node scripts/etl/etl.ts [flags]
 *
 * Flags (docs/target/data-migration.md §2):
 *   --only <keys>         comma-separated phase keys (prefix match), e.g. --only 10,20
 *   --from <key>          run from this phase to the end
 *   --dry-run             extract + transform, print counts, write nothing
 *   --truncate            truncate each phase's target tables before loading
 *   --limit <n>           dev aid: cap non-telemetry extracts at n rows/table
 *   --since <YYYY-MM-DD>   telemetry hard floor
 *   --budget-mb <n>       telemetry: stop loading older rows past this table size
 *   --max-rows <n>        telemetry: absolute row ceiling
 *   --drop-rawbody-before <YYYY-MM-DD>
 *   --mysql-dsn / --mongo-uri / --target-dsn   override source/target
 *   --verbose
 *
 * Idempotent: every phase either truncates-then-loads or upserts on PK, so a
 * full re-run converges (§11). `etl.user_id_map` is stable across re-runs
 * unless auth.users is also truncated.
 */

import { args, describeConfig } from './config.ts';
import { closeAll } from './lib/sources.ts';
import { RUN_ID, startPhase, info, fail } from './lib/log.ts';
import { reportUnresolved } from './lib/unresolved.ts';
import { truncate } from './lib/load.ts';
import { selectPhases } from './phases/index.ts';
import { pgPool } from './lib/sources.ts';

async function main(): Promise<void> {
  info(`assetgrid ETL — run ${RUN_ID}`);
  console.log(describeConfig());

  const phases = selectPhases(args.only, args.from);
  info(`phases: ${phases.map((p) => p.key).join(' → ')}`);

  // fresh unresolved audit for the phases we're about to (re-)run
  if (!args.dryRun) {
    await pgPool().query('delete from etl.unresolved where phase = any($1)', [
      phases.map((p) => p.key),
    ]);
  }

  let grandTotal = 0;
  for (const phase of phases) {
    const run = await startPhase(phase.key);
    try {
      if (args.truncate && phase.targetTables.length && phase.key !== '10-reference') {
        await truncate(phase.targetTables);
      }
      const result = await phase.run();
      if (result.skipped) {
        await run.skip(result.notes ?? 'nothing to do');
      } else {
        await run.ok(result.rowsLoaded, result.sourceRows, result.notes);
        grandTotal += result.rowsLoaded;
      }
    } catch (err) {
      await run.error(err);
      throw err;
    }
  }

  await reportUnresolved();
  info(`done — ${grandTotal} rows loaded across ${phases.length} phase(s)`);
}

main()
  .catch((err) => {
    fail(String((err as Error)?.stack ?? err));
    process.exitCode = 1;
  })
  .finally(() => closeAll());
