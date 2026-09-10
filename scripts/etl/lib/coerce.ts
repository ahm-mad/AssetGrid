/**
 * Column-level type coercions — spec §6.1 (everywhere) and §8.3 (Mongo).
 *
 * Every helper accepts the messy source value (string | number | null |
 * Buffer | Date | Mongo BSON) and returns a value `pg` will bind correctly,
 * or `null`. They never throw — a bad value becomes `null` and the caller is
 * expected to log it to `etl.unresolved` where it matters.
 */

export type Nullable<T> = T | null;

const EMPTY = new Set(['', 'null', 'NULL', 'undefined', '\\N']);

export function nz(v: unknown): Nullable<string> {
  if (v === null || v === undefined) return null;
  const s = typeof v === 'string' ? v : String(v);
  return EMPTY.has(s.trim()) ? null : s;
}

/** string-boolean → boolean (§6.1). `'1'|'true'|'t'|'yes'|1|true` → true. */
export function toBool(v: unknown): Nullable<boolean> {
  if (v === null || v === undefined) return null;
  if (typeof v === 'boolean') return v;
  const s = String(v).trim().toLowerCase();
  if (EMPTY.has(s)) return null;
  if (['1', 'true', 't', 'yes', 'y', 'on'].includes(s)) return true;
  if (['0', 'false', 'f', 'no', 'n', 'off'].includes(s)) return false;
  return null;
}

/** numeric-ish → JS number (for pg `numeric`/`int`), else null. */
export function toNum(v: unknown): Nullable<number> {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (EMPTY.has(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** integer → JS number rounded, else null. */
export function toInt(v: unknown): Nullable<number> {
  const n = toNum(v);
  return n === null ? null : Math.trunc(n);
}

/**
 * bigint id kept as a string (mysql2 is configured bigNumberStrings) — we only
 * pass it straight through to pg which accepts a numeric string for `bigint`.
 */
const PG_BIGINT_MAX = 9223372036854775807n;

export function toId(v: unknown): Nullable<string> {
  const s = nz(v);
  if (s === null) return null;
  const t = s.trim();
  if (!/^-?\d+$/.test(t)) return null;
  // MySQL `bigint unsigned` sentinels (e.g. 2^64-1) overflow signed bigint.
  try {
    const n = BigInt(t);
    if (n > PG_BIGINT_MAX || n < -PG_BIGINT_MAX - 1n) return null;
  } catch {
    return null;
  }
  return t;
}

/**
 * money — `decimal` passes straight through; the `int(11)` money columns in
 * quotes/reservations are assumed WHOLE DOLLARS (§6.1, ADR-026). Returns a
 * string so pg keeps the exact scale.
 */
export function toMoney(v: unknown): Nullable<string> {
  const n = toNum(v);
  return n === null ? null : n.toFixed(2);
}

export function toRate(v: unknown, scale = 4): Nullable<string> {
  const n = toNum(v);
  return n === null ? null : n.toFixed(scale);
}

/** latitude/longitude — parse, range-check, clamp scale. Out of range → null. */
export function toLat(v: unknown): Nullable<string> {
  const n = toNum(v);
  if (n === null || n < -90 || n > 90) return null;
  return n.toFixed(8);
}
export function toLon(v: unknown): Nullable<string> {
  const n = toNum(v);
  if (n === null || n < -180 || n > 180) return null;
  return n.toFixed(8);
}
export function toAlt(v: unknown): Nullable<string> {
  const n = toNum(v);
  if (n === null) return null;
  return n.toFixed(4);
}

/**
 * nullable source `timestamp` → not-null `timestamptz`.
 * Order of fallback per §6.1: value → created_at → now(). Old app stored naive
 * UTC, so a bare 'YYYY-MM-DD HH:MM:SS' is interpreted as UTC.
 */
export function toTs(
  v: unknown,
  ...fallbacks: unknown[]
): string {
  const direct = tryTs(v);
  if (direct) return direct;
  for (const f of fallbacks) {
    const t = tryTs(f);
    if (t) return t;
  }
  return new Date().toISOString();
}

/** nullable timestamp that stays nullable. */
export function toTsN(v: unknown): Nullable<string> {
  return tryTs(v);
}

function tryTs(v: unknown): Nullable<string> {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return isNaN(+v) ? null : v.toISOString();
  // Mongo BSON date arrives as { $date: ... } only through mongoexport; the
  // driver gives a JS Date, handled above.
  const s = String(v).trim();
  if (EMPTY.has(s) || s === '0000-00-00 00:00:00' || s.startsWith('0000-00-00')) {
    return null;
  }
  // bare 'YYYY-MM-DD HH:MM:SS' (no tz) → treat as UTC
  const bare = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/;
  const iso = bare.test(s) ? s.replace(' ', 'T') + 'Z' : s;
  const d = new Date(iso);
  return isNaN(+d) ? null : d.toISOString();
}

/** date-only column ('YYYY-MM-DD'), stays nullable. */
export function toDate(v: unknown): Nullable<string> {
  const s = nz(v);
  if (s === null) return null;
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1] === '0000-00-00' ? null : m[1];
  const d = new Date(s);
  return isNaN(+d) ? null : d.toISOString().slice(0, 10);
}

/** time column ('HH:MM[:SS]'), stays nullable. */
export function toTime(v: unknown): Nullable<string> {
  const s = nz(v);
  if (s === null) return null;
  const m = s.match(/(\d{1,2}):(\d{2})(:\d{2})?/);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}${m[3] ?? ':00'}` : null;
}

/**
 * MariaDB JSON column (longtext + json_valid CHECK) or a Mongo string body →
 * a value pg accepts for `jsonb`. Returns a JS object/array/scalar, or null.
 * Invalid JSON → null (caller logs to etl.unresolved where it matters).
 */
export function toJsonb(v: unknown): Nullable<unknown> {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object') return v; // already parsed (Mongo driver / mysql2 JSON type)
  const s = String(v).trim();
  if (EMPTY.has(s)) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/** phone bigint → text, preserving digits. */
export function toPhone(v: unknown): Nullable<string> {
  const s = nz(v);
  if (s === null) return null;
  const digits = s.replace(/[^\d+]/g, '');
  return digits || null;
}

/** CSV varchar → text[] (trim, drop blanks). §7 notification_addresses. */
export function toTextArray(v: unknown, sep = ','): Nullable<string[]> {
  const s = nz(v);
  if (s === null) return null;
  const parts = s
    .split(sep)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length ? parts : null;
}

/**
 * Some legacy columns (detail_users.container_id / inventory_device_id) are
 * DOUBLE-encoded: a JSON string whose content is a JSON array
 * (`'"[2197,2198]"'`). Decode until we hit a non-string or fail.
 */
function deepJson(v: unknown): unknown {
  let cur = toJsonb(v);
  for (let i = 0; i < 3 && typeof cur === 'string'; i++) {
    const next = toJsonb(cur);
    if (next === cur) break;
    cur = next;
  }
  return cur;
}

/** JSON array of ints → number[] (filtered to finite ints). */
export function toIntArray(v: unknown): Nullable<number[]> {
  const parsed = deepJson(v);
  if (!Array.isArray(parsed)) return null;
  const out = parsed
    .map((x) => toInt(x))
    .filter((x): x is number => x !== null);
  return out.length ? out : null;
}

/** JSON array of strings → string[] (e.g. detail_users.container_id codes). */
export function toStrArray(v: unknown): Nullable<string[]> {
  const parsed = deepJson(v);
  if (!Array.isArray(parsed)) return null;
  const out = parsed
    .map((x) => nz(x))
    .filter((x): x is string => x !== null);
  return out.length ? out : null;
}

/**
 * jsonb bind value for node-postgres. pg turns a JS array parameter into a
 * Postgres ARRAY literal, which is wrong for `jsonb` columns — so jsonb values
 * must be pre-stringified. Objects would be auto-stringified but we do it here
 * too for consistency. Use this for every `jsonb` column; pass raw JS arrays
 * only to `text[]` / `bigint[]` columns.
 */
export function jsonParam(v: unknown): Nullable<string> {
  const parsed = toJsonb(v);
  return parsed === null ? null : JSON.stringify(parsed);
}

/** Already-a-value (object/array/scalar) → jsonb bind string. */
export function toJsonParam(v: unknown): Nullable<string> {
  if (v === null || v === undefined) return null;
  return JSON.stringify(v);
}

export function upper(v: unknown): Nullable<string> {
  const s = nz(v);
  return s === null ? null : s.toUpperCase();
}

export function lower(v: unknown): Nullable<string> {
  const s = nz(v);
  return s === null ? null : s.toLowerCase();
}
