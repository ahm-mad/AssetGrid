/**
 * `etl.user_id_map` — the single bigint→uuid remap (ADR-021).
 *
 * Phase 20 (auth users) builds and persists the map. Every later phase calls
 * `loadIdMap()` once, then `uid(legacyId)` to translate a `user_id` /
 * `created_by` / `*_by` column. Unknown ids return null (caller logs to
 * etl.unresolved if the column is NOT NULL in the target).
 */

import { pgPool } from './sources.ts';

let map: Map<string, string> | undefined;

export async function loadIdMap(): Promise<Map<string, string>> {
  if (map) return map;
  const { rows } = await pgPool().query<{ legacy_id: string; id: string }>(
    `select legacy_id::text, id::text from etl.user_id_map`,
  );
  map = new Map(rows.map((r) => [r.legacy_id, r.id]));
  return map;
}

/** Translate a legacy user id (any shape) to the new uuid, or null. */
export function uid(legacyId: unknown): string | null {
  if (!map) throw new Error('idmap not loaded — call loadIdMap() first');
  if (legacyId === null || legacyId === undefined) return null;
  const key = String(legacyId).trim();
  if (!/^\d+$/.test(key)) return null;
  return map.get(key) ?? null;
}

export function idMapSize(): number {
  return map?.size ?? 0;
}

/** For phase 20 to populate the in-memory map as it inserts. */
export function primeIdMap(pairs: Iterable<[string, string]>): void {
  map = new Map(pairs);
}
