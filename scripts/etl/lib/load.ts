/**
 * Generic loaders — batched multi-row INSERT, truncate, setval, counts.
 *
 * Idempotency model (spec §11): a phase either `truncate`s its target tables
 * then loads, or upserts on the PK. `--truncate` picks the former; without it
 * loaders default to `onConflict: 'ignore'` so a re-run converges.
 *
 * The bulk telemetry load uses COPY (lib/copy.ts) instead — this file is for
 * the <100k-row tables where a parametrised INSERT is simplest and safe.
 */

import type { PoolClient } from 'pg';
import { pgPool } from './sources.ts';
import { args } from '../config.ts';
import { debug } from './log.ts';

const PG_MAX_PARAMS = 65535;

export type ConflictMode =
  | 'error'
  | 'ignore'
  | { onConflict: string; setColumns?: string[] };

export interface LoadOptions {
  /** columns in the order the row tuples supply them */
  columns: string[];
  /** conflict handling; default 'ignore' */
  conflict?: ConflictMode;
  /** rows per INSERT statement; auto-capped by the pg param limit */
  batchSize?: number;
  client?: PoolClient;
}

function ident(name: string): string {
  // table may be schema-qualified: public.foo
  return name
    .split('.')
    .map((p) => `"${p.replace(/"/g, '""')}"`)
    .join('.');
}

/** Load an array of row tuples (each tuple aligned with `options.columns`). */
export async function loadRows(
  table: string,
  rows: unknown[][],
  options: LoadOptions,
): Promise<number> {
  if (rows.length === 0) return 0;
  if (args.dryRun) return rows.length;

  const cols = options.columns;
  const perRow = cols.length;
  const maxByParams = Math.max(1, Math.floor(PG_MAX_PARAMS / perRow));
  const batchSize = Math.min(options.batchSize ?? 1000, maxByParams);
  const conflict = options.conflict ?? 'ignore';

  const colList = cols.map(ident).join(', ');
  let conflictClause = '';
  if (conflict === 'ignore') {
    conflictClause = ' on conflict do nothing';
  } else if (typeof conflict === 'object') {
    const set =
      conflict.setColumns && conflict.setColumns.length
        ? ` do update set ${conflict.setColumns
            .map((c) => `${ident(c)} = excluded.${ident(c)}`)
            .join(', ')}`
        : ' do nothing';
    conflictClause = ` on conflict ${conflict.onConflict}${set}`;
  }

  const runner = options.client ?? pgPool();
  let loaded = 0;

  for (let start = 0; start < rows.length; start += batchSize) {
    const slice = rows.slice(start, start + batchSize);
    const params: unknown[] = [];
    const tuples = slice
      .map((row) => {
        const placeholders = row.map((val) => {
          params.push(val);
          return `$${params.length}`;
        });
        return `(${placeholders.join(', ')})`;
      })
      .join(', ');

    const sql = `insert into ${ident(table)} (${colList}) values ${tuples}${conflictClause}`;
    const res = await runner.query(sql, params);
    loaded += res.rowCount ?? 0;
  }
  debug(`${table}: inserted ${loaded}/${rows.length}`);
  return loaded;
}

/** TRUNCATE ... RESTART IDENTITY CASCADE for a set of tables (one statement). */
export async function truncate(
  tables: string[],
  client?: PoolClient,
): Promise<void> {
  if (args.dryRun || tables.length === 0) return;
  const runner = client ?? pgPool();
  await runner.query(
    `truncate ${tables.map(ident).join(', ')} restart identity cascade`,
  );
  debug(`truncated ${tables.join(', ')}`);
}

/** Reset an identity/serial sequence to max(id) (spec §12). */
export async function setval(
  table: string,
  idColumn = 'id',
  client?: PoolClient,
): Promise<void> {
  if (args.dryRun) return;
  const runner = client ?? pgPool();
  await runner.query(
    `select setval(
       pg_get_serial_sequence($1, $2),
       coalesce((select max(${ident(idColumn)}) from ${ident(table)}), 1),
       true)`,
    [table, idColumn],
  );
}

/**
 * Convenience: load an array of plain objects. Columns are the union of keys
 * in `rows` (stable order from the first row + any extras appended). A missing
 * key on a later row binds NULL.
 */
export async function loadObjects(
  table: string,
  rows: Record<string, unknown>[],
  opts: { conflict?: ConflictMode; batchSize?: number; client?: PoolClient } = {},
): Promise<number> {
  if (rows.length === 0) return 0;
  const columns: string[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    for (const k of Object.keys(r)) {
      if (!seen.has(k)) {
        seen.add(k);
        columns.push(k);
      }
    }
  }
  const tuples = rows.map((r) => columns.map((c) => (c in r ? r[c] : null)));
  return loadRows(table, tuples, {
    columns,
    conflict: opts.conflict,
    batchSize: opts.batchSize,
    client: opts.client,
  });
}

/** Build an "update every column except the conflict target" upsert mode. */
export function upsert(
  onConflict: string,
  allColumns: string[],
  keyColumns: string[],
): ConflictMode {
  const keys = new Set(keyColumns);
  return {
    onConflict,
    setColumns: allColumns.filter((c) => !keys.has(c) && c !== 'created_at'),
  };
}

export async function targetCount(
  table: string,
  where?: string,
): Promise<number> {
  const { rows } = await pgPool().query<{ c: string }>(
    `select count(*)::text c from ${ident(table)}${where ? ` where ${where}` : ''}`,
  );
  return Number(rows[0].c);
}
