/**
 * Phase 12 — finalise (spec §4 row 12, §12).
 *
 *   - `setval` every id-preserving sequence to max(id) so app inserts don't
 *     collide with migrated ids.
 *   - `analyze` the freshly-loaded tables so the planner has stats.
 *
 * Safe to run repeatedly. Detailed row-count reconciliation lives in verify.ts.
 */

import type { Phase, PhaseResult } from './types.ts';
import { pgPool } from '../lib/sources.ts';
import { args } from '../config.ts';
import { info } from '../lib/log.ts';

const KEY = '99z-finalise';

export const phase: Phase = {
  key: KEY,
  title: 'Finalise — setval every sequence, analyze',
  targetTables: [],

  async run(): Promise<PhaseResult> {
    const pg = pgPool();

    // every non-partition public base table whose `id` defaults from a sequence
    const { rows: seqs } = await pg.query<{ table_name: string }>(`
      select c.table_name
        from information_schema.columns c
        join pg_class pc on pc.relname = c.table_name
        join pg_namespace pn on pn.oid = pc.relnamespace and pn.nspname = 'public'
       where c.table_schema = 'public'
         and c.column_name = 'id'
         and (c.identity_generation is not null or c.column_default like 'nextval(%')
         and pc.relispartition = false
         and pc.relkind = 'r'
       order by 1`);

    let fixed = 0;
    let skipped = 0;
    for (const { table_name } of seqs) {
      if (args.dryRun) { fixed++; continue; }
      try {
        await pg.query(
          `select setval(
             pg_get_serial_sequence('public.' || quote_ident($1), 'id'),
             greatest(coalesce((select max(id) from public.${quoteIdent(table_name)}), 1), 1),
             true)`,
          [table_name],
        );
        fixed++;
      } catch (err) {
        skipped++;
        info(`   setval skipped ${table_name}: ${(err as Error).message}`);
      }
    }
    info(`   setval on ${fixed} sequences${skipped ? ` (${skipped} skipped)` : ''}`);

    if (!args.dryRun) {
      await pg.query('analyze');
      info('   analyze complete');
    }

    return { rowsLoaded: 0, sourceRows: 0, notes: `${fixed} sequences reset` };
  },
};

function quoteIdent(name: string): string {
  return '"' + name.replace(/"/g, '""') + '"';
}
