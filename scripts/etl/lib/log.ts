/**
 * Console logging + `etl.run_log` bookkeeping.
 */

import { pgPool } from './sources.ts';
import { args } from '../config.ts';

export const RUN_ID = new Date()
  .toISOString()
  .replace(/[-:]/g, '')
  .replace(/\.\d+Z$/, 'Z');

const t0 = Date.now();
function stamp(): string {
  const s = ((Date.now() - t0) / 1000).toFixed(1).padStart(6);
  return `[${s}s]`;
}

export function info(msg: string): void {
  console.log(`${stamp()} ${msg}`);
}
export function warn(msg: string): void {
  console.warn(`${stamp()} ⚠ ${msg}`);
}
export function debug(msg: string): void {
  if (args.verbose) console.log(`${stamp()}   ${msg}`);
}
export function fail(msg: string): void {
  console.error(`${stamp()} ✗ ${msg}`);
}

export interface PhaseRun {
  ok(rowsLoaded: number, sourceRows?: number, notes?: string): Promise<void>;
  skip(notes: string): Promise<void>;
  error(err: unknown): Promise<void>;
}

/** Open a run_log row for a phase; returns finishers. No-op writes in dry-run. */
export async function startPhase(phase: string): Promise<PhaseRun> {
  info(`── phase ${phase} ────────────────────────────────────────`);
  if (args.dryRun) {
    return {
      async ok(rows, src, notes) {
        info(`   ${phase}: would load ${rows} rows` + (src != null ? ` from ${src} source` : '') + (notes ? ` — ${notes}` : ''));
      },
      async skip(notes) {
        info(`   ${phase}: skipped — ${notes}`);
      },
      async error(err) {
        fail(`   ${phase}: ${(err as Error)?.message ?? err}`);
      },
    };
  }

  const { rows } = await pgPool().query<{ id: string }>(
    `insert into etl.run_log (run_id, phase, status) values ($1, $2, 'running') returning id`,
    [RUN_ID, phase],
  );
  const id = rows[0].id;

  return {
    async ok(rowsLoaded, sourceRows, notes) {
      await pgPool().query(
        `update etl.run_log
            set status='ok', finished_at=now(), rows_loaded=$2, source_rows=$3, notes=$4
          where id=$1`,
        [id, rowsLoaded, sourceRows ?? null, notes ?? null],
      );
      info(`   ${phase}: loaded ${rowsLoaded} rows` + (sourceRows != null ? ` (source ${sourceRows})` : '') + (notes ? ` — ${notes}` : ''));
    },
    async skip(notes) {
      await pgPool().query(
        `update etl.run_log set status='skipped', finished_at=now(), notes=$2 where id=$1`,
        [id, notes],
      );
      info(`   ${phase}: skipped — ${notes}`);
    },
    async error(err) {
      const message = (err as Error)?.stack ?? String(err);
      await pgPool().query(
        `update etl.run_log set status='error', finished_at=now(), error=$2 where id=$1`,
        [id, message.slice(0, 8000)],
      );
      fail(`   ${phase}: ${(err as Error)?.message ?? err}`);
    },
  };
}
