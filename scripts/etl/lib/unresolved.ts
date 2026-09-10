/**
 * `etl.unresolved` audit writer (spec §1.4, §6.2, §10.4).
 *
 * Every loose varchar FK (B10) or coercion that could not be resolved goes
 * here with enough context for a human to sign off the residue in verify.ts.
 * Buffered and flushed in batches so we never bottleneck a phase on it.
 */

import { pgPool } from './sources.ts';
import { args } from '../config.ts';
import { warn } from './log.ts';

interface Row {
  phase: string;
  table: string;
  column: string;
  rawValue: string | null;
  targetRowId: string | null;
  reason: string;
}

const buffer: Row[] = [];
let total = 0;

export function unresolved(
  phase: string,
  table: string,
  column: string,
  rawValue: unknown,
  targetRowId: unknown,
  reason: string,
): void {
  total++;
  buffer.push({
    phase,
    table,
    column,
    rawValue: rawValue == null ? null : String(rawValue).slice(0, 500),
    targetRowId: targetRowId == null ? null : String(targetRowId),
    reason,
  });
  if (buffer.length >= 500) void flushUnresolved();
}

export async function flushUnresolved(): Promise<void> {
  if (buffer.length === 0 || args.dryRun) {
    buffer.length = 0;
    return;
  }
  const batch = buffer.splice(0, buffer.length);
  const values: unknown[] = [];
  const tuples = batch
    .map((r, i) => {
      const b = i * 6;
      values.push(r.phase, r.table, r.column, r.rawValue, r.targetRowId, r.reason);
      return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6})`;
    })
    .join(',');
  await pgPool().query(
    `insert into etl.unresolved (phase, table_name, column_name, raw_value, target_row_id, reason)
     values ${tuples}`,
    values,
  );
}

export function unresolvedCount(): number {
  return total;
}

export async function reportUnresolved(): Promise<void> {
  await flushUnresolved();
  if (total > 0) warn(`${total} unresolved reference(s) logged to etl.unresolved`);
}
