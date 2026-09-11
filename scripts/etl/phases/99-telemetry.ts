/**
 * Phase 11 — telemetry (spec §8, ADR-016/022/029; window narrowed by user
 * decision 2026-09-11 — ADR-039 supersedes the breadth-over-depth rollup
 * design, ADR-038, which is reverted). Runs LAST.
 *
 * Telemetry rows are migrated as real raw packets, same shape as the legacy
 * device_values/device_values_dump/Mongo rows — no aggregation, no squeezing.
 * Space is managed purely by loading a SHORT RECENT WINDOW (default: the last
 * 6 hours) rather than history; a longer-history telemetry strategy is a
 * deliberately deferred follow-up (the user has a different approach in mind).
 *
 * Sources (a time-split, not a duplicate — §8.1), both bounded by the same cutoff:
 *   - Mongo  device_values      newest, ongoing        → last N hours
 *   - MySQL  device_values      2025-03 … 2025-06      → last N hours
 *   - MySQL  device_values_dump 2024-10 … 2025-03      → none by default
 *
 * The cut is parametrised:
 *   --hours <n>                hard floor, precise to the hour (default 6)
 *   --since <YYYY-MM-DD[THH:MM:SS]>  overrides --hours with an exact cutoff
 *   --budget-mb <n>            stop loading older MySQL rows once
 *                              pg_total_relation_size('telemetry') crosses this (default 150)
 *   --max-rows <n>             absolute ceiling across all sources
 *   --drop-rawbody-before <d>  store raw_body/raw_packet NULL for rows older than d
 *                              (opt-in — off by default; this phase keeps full
 *                              raw parity with the legacy rows by default)
 *   --include-dump            also stream device_values_dump (newest-first, same guards)
 *   --telemetry-batch <n>     insert batch size (default 2000)
 *
 * Dedupe: a DB unique index (telemetry_dedupe_idx on dev_eui, created_at,
 * coalesce(legacy_id,-1)) + `on conflict do nothing`, so a re-run without
 * --truncate converges instead of duplicating (§8.2 key). Mongo docs with a
 * legacy_id shadow the MySQL row of that id — those MySQL ids are recorded
 * and skipped in-run too, before they'd even reach the DB check.
 *
 * Post-load: resolve neo_alarm_logs / alert_state / alert_log references that
 * pointed at Mongo `_id`s or MySQL ids (only for rows inside this window —
 * older ones stay unresolved, which is fine, they're audit trails), and
 * rebuild user_devices.last_reading*.
 *
 * ⚠ Build/scan RECENT records only (ADR-029) — never SELECT * the full tables.
 */

import type { Phase, PhaseResult } from './types.ts';
import { mongo, pgPool, withPgClient } from '../lib/sources.ts';
import { mysqlStream, mysqlOne } from '../lib/read.ts';
import { loadIdMap } from '../lib/idmap.ts';
import { args } from '../config.ts';
import { info, warn } from '../lib/log.ts';
import { unresolved } from '../lib/unresolved.ts';
import {
  toId, toTsN, nz, upper, toBool, toNum, toLat, toLon, toAlt, toInt, toJsonParam, jsonParam,
} from '../lib/coerce.ts';

const KEY = '99-telemetry';

const COLS = [
  'created_at', 'updated_at', 'dev_eui', 'gateway_id', 'user_id',
  'user_device_id', 'inventory_device_id',
  'energy_consumption_meter_consumed', 'energy_consumption_meter_elapsed',
  'active_power', 'apparent_power', 'reactive_power', 'power_factor', 'voltage', 'current',
  'humidity', 'temperature', 'luminosity',
  'external_input', 'light', 'move', 'reed_state',
  'latitude', 'longitude', 'altitude',
  'raw_body', 'raw_packet', 'xup_encoded_edr', 'xup_decoded_edr',
  'legacy_id', 'legacy_mongo_id', 'raw_source',
];

function num(v: unknown) { return toNum(v); }

export const phase: Phase = {
  key: KEY,
  title: 'Telemetry — last N hours of Mongo + MySQL device_values (raw, no thinning)',
  targetTables: [], // never truncated by --truncate; managed here

  async run(): Promise<PhaseResult> {
    const idMap = await loadIdMap();
    const pg = pgPool();

    // Guard against two telemetry loads racing (this bit us once already — a
    // leftover process from a killed run kept writing while a fresh run
    // started, doubling rows). One session-scoped advisory lock; bail loudly
    // if another run already holds it instead of silently duplicating data.
    const lockKey = 991_099; // arbitrary, telemetry-phase-specific
    const { rows: lockRows } = await pg.query<{ locked: boolean }>(
      'select pg_try_advisory_lock($1) as locked', [lockKey],
    );
    if (!lockRows[0].locked) {
      throw new Error(
        'another telemetry load already holds the advisory lock — ' +
        'check for a leftover `etl.ts` process before retrying',
      );
    }
    try {
      return await runTelemetryLoad(pg, idMap);
    } finally {
      await pg.query('select pg_advisory_unlock($1)', [lockKey]);
    }
  },
};

async function runTelemetryLoad(
  pg: ReturnType<typeof pgPool>,
  idMap: Awaited<ReturnType<typeof loadIdMap>>,
): Promise<PhaseResult> {
    const batchSize = num(cliVal('telemetry-batch')) ?? 2000;
    // ADR-039: keep full raw parity with the legacy rows (no thinning by
    // default), just for a short recent window instead of history.
    const budgetMb = args.budgetMb ?? 150;
    const maxRows = args.maxRows ?? Infinity;
    const hours = num(cliVal('hours')) ?? 6;
    // full-precision ISO cutoff; --since (a date or full timestamp) overrides --hours
    const since = args.since
      ? new Date(args.since).toISOString()
      : new Date(Date.now() - hours * 3600_000).toISOString();
    const dropRawBefore = args.dropRawBodyBefore ? Date.parse(args.dropRawBodyBefore) : null;
    const includeDump = process.argv.includes('--include-dump');

    // FK validation sets — the source's user_device_id/inventory_device_id
    // aren't trustworthy as-is (stale/deleted references observed in the dev
    // Mongo data caused an FK violation the first time this ran without a
    // check). Null out anything that doesn't resolve rather than fail the batch.
    const validUserDeviceIds = new Set(
      (await pg.query<{ id: string }>('select id::text from user_devices')).rows.map((r) => r.id),
    );
    const validInventoryDeviceIds = new Set(
      (await pg.query<{ id: string }>('select id::text from inventory_devices')).rows.map((r) => r.id),
    );
    const udOf = (v: unknown): string | null => {
      const id = toId(v);
      return id && validUserDeviceIds.has(id) ? id : null;
    };
    const invOf = (v: unknown): string | null => {
      const id = toId(v);
      return id && validInventoryDeviceIds.has(id) ? id : null;
    };

    // user_id (bigint) -> uuid, resolved before insert
    const uidOf = (v: unknown): string | null => {
      const k = toId(v);
      return k ? idMap.get(k) ?? null : null;
    };

    let total = 0;
    let skippedDup = 0;
    const seen = new Set<string>();
    const mongoLegacyIds = new Set<string>(); // MySQL ids shadowed by a Mongo doc

    // batch buffer
    let inserted = 0; // rows actually written (post ON CONFLICT DO NOTHING)
    let buf: unknown[][] = [];
    const flush = async (): Promise<void> => {
      if (buf.length === 0) return;
      const rows = buf;
      buf = [];
      await withPgClient(async (client) => {
        const params: unknown[] = [];
        const tuples = rows
          .map((r) => {
            const ph = r.map((val) => {
              params.push(val);
              return `$${params.length}`;
            });
            return `(${ph.join(',')})`;
          })
          .join(',');
        // dedupe at the DB level (telemetry_dedupe_idx) so a re-run without
        // --truncate, or two processes racing, converges instead of
        // duplicating (caught during the Phase N+1 dev proof-run).
        const res = await client.query(
          `insert into telemetry (${COLS.join(',')}) values ${tuples}
           on conflict (dev_eui, created_at, (coalesce(legacy_id, -1))) do nothing`,
          params,
        );
        inserted += res.rowCount ?? 0;
      });
      total += rows.length;
    };

    const key = (devEui: string | null, createdAt: string | null, legacyId: string | null): string =>
      `${devEui ?? ''}|${(createdAt ?? '').slice(0, 19)}|${legacyId ?? '-1'}`;

    const budgetExceeded = async (): Promise<boolean> => {
      const { rows } = await pg.query<{ mb: number }>(
        `select pg_total_relation_size('public.telemetry') / 1048576.0 as mb`,
      );
      return rows[0].mb >= budgetMb;
    };

    // -----------------------------------------------------------------
    // 1. Mongo — last `--since` days only (ADR-038 revises §8.4 step 1,
    //    which loaded all of Mongo; the full history now lives in
    //    telemetry_daily_rollup). Sorted newest-first and stopped once we
    //    cross `since` — a doc's Mongo `_id` roughly tracks insertion order,
    //    which is good enough for a short recent window (the ~21 legacy
    //    backfilled docs from a single one-time script run are the only
    //    known _id/created_at mismatch, and they're old — irrelevant here).
    // -----------------------------------------------------------------
    info(`   streaming Mongo device_values (id desc, since ${since})…`);
    const db = await mongo();
    const cursor = db.collection('device_values').find({}, { sort: { _id: -1 } }).batchSize(2000);
    let mongoStop = false;
    for await (const doc of cursor) {
      if (mongoStop || total >= maxRows) break;
      const d = doc as Record<string, unknown>;
      const createdAt = toMongoTs(d.created_at) ?? toMongoTs(d._id);
      if (createdAt && createdAt < since) { mongoStop = true; break; }
      const devEui = upper(d.devEUI);
      const legacyId = toId(d.legacy_id);
      if (legacyId) mongoLegacyIds.add(legacyId);
      const k = key(devEui, createdAt, legacyId);
      if (seen.has(k)) { skippedDup++; continue; }
      seen.add(k);
      const dropRaw = dropRawBefore != null && createdAt != null && Date.parse(createdAt) < dropRawBefore;
      buf.push(mkRow({
        created_at: createdAt,
        updated_at: toMongoTs(d.updated_at) ?? createdAt,
        dev_eui: devEui,
        gateway_id: nz(d.gatewayID),
        user_id: uidOf(d.user_id),
        user_device_id: udOf(d.user_device_id),
        inventory_device_id: invOf(d.inventory_device_id),
        electrical: d,
        env: d,
        geo: d,
        raw_body: dropRaw ? null : jsonParam(d.json_body),
        raw_packet: dropRaw ? null : nz(d.raw_packet),
        xup_encoded_edr: nz(d.xup_encoded_edr),
        xup_decoded_edr: d.xup_decoded_edr != null ? toJsonParam(d.xup_decoded_edr) : null,
        legacy_id: legacyId,
        legacy_mongo_id: String(d._id),
        raw_source: 'mongo_device_values',
      }));
      if (buf.length >= batchSize) await flush();
    }
    await flush();
    info(`   Mongo done — ${total} rows (${skippedDup} dup skipped)`);

    // -----------------------------------------------------------------
    // 2. MySQL device_values — newest-first until a guard trips (§8.4 step 2)
    // -----------------------------------------------------------------
    if (total < maxRows && !(await budgetExceeded())) {
      info(`   streaming MySQL device_values (id desc, since ${since})…`);
      let checked = 0;
      let stop = false;
      for await (const row of mysqlStream<Record<string, unknown>>(
        'select * from device_values order by id desc',
      )) {
        if (stop || total >= maxRows) break;
        checked++;
        const legacyId = toId(row.id);
        if (legacyId && mongoLegacyIds.has(legacyId)) { skippedDup++; continue; }
        const createdAt = mysqlTs(row.created_at);
        if (createdAt && since && createdAt < since) { stop = true; break; }
        const devEui = upper(row.devEUI);
        const k = key(devEui, createdAt, legacyId);
        if (seen.has(k)) { skippedDup++; continue; }
        seen.add(k);
        const dropRaw = dropRawBefore != null && createdAt != null && Date.parse(createdAt) < dropRawBefore;
        buf.push(mkRow({
          created_at: createdAt,
          updated_at: mysqlTs(row.updated_at) ?? createdAt,
          dev_eui: devEui,
          gateway_id: nz(row.gatewayID),
          user_id: uidOf(row.user_id),
          user_device_id: udOf(row.user_device_id),
          inventory_device_id: invOf(row.inventory_device_id),
          electrical: row,
          env: row,
          geo: row,
          raw_body: dropRaw ? null : jsonParam(row.json_body),
          raw_packet: null,
          xup_encoded_edr: null,
          xup_decoded_edr: null,
          legacy_id: legacyId,
          legacy_mongo_id: null,
          raw_source: 'mysql_device_values',
        }));
        if (buf.length >= batchSize) {
          await flush();
          if (await budgetExceeded()) { stop = true; warn(`budget ${budgetMb}MB reached — stopping MySQL device_values`); }
        }
      }
      await flush();
      info(`   MySQL device_values done — scanned ${checked}, total now ${total}`);
    }

    // -----------------------------------------------------------------
    // 3. device_values_dump — only with --include-dump
    // -----------------------------------------------------------------
    if (includeDump && total < maxRows && !(await budgetExceeded())) {
      info('   streaming MySQL device_values_dump (id desc)…');
      let stop = false;
      for await (const row of mysqlStream<Record<string, unknown>>(
        'select * from device_values_dump order by id desc',
      )) {
        if (stop || total >= maxRows) break;
        const legacyId = toId(row.id);
        const createdAt = mysqlTs(row.created_at);
        const devEui = upper(row.devEUI);
        const k = key(devEui, createdAt, legacyId);
        if (seen.has(k)) { skippedDup++; continue; }
        seen.add(k);
        buf.push(mkRow({
          created_at: createdAt, updated_at: mysqlTs(row.updated_at) ?? createdAt,
          dev_eui: devEui, gateway_id: nz(row.gatewayID),
          user_id: uidOf(row.user_id),
          user_device_id: udOf(row.user_device_id),
          inventory_device_id: invOf(row.inventory_device_id),
          electrical: row, env: row, geo: row,
          raw_body: null, raw_packet: null, xup_encoded_edr: null, xup_decoded_edr: null,
          legacy_id: legacyId, legacy_mongo_id: null, raw_source: 'mysql_device_values_dump',
        }));
        if (buf.length >= batchSize) {
          await flush();
          if (await budgetExceeded()) { stop = true; warn(`budget ${budgetMb}MB reached — stopping dump`); }
        }
      }
      await flush();
    }

    // -----------------------------------------------------------------
    // 4. Post-load reference resolution (§8.5)
    // -----------------------------------------------------------------
    if (!args.dryRun && total > 0) {
      info('   resolving telemetry-dependent references…');
      // The source kept a Mongo `_id` (or a MySQL device_values id) as a varchar.
      // Re-read those refs and map them to telemetry.id via legacy_mongo_id /
      // legacy_id. Rows outside the loaded slice stay null (audit / non-critical).
      await resolveRef(pg, 'neo_alarm_logs', 'device_value_id', 'telemetry_id');
      await resolveRef(pg, 'xup_notification_info', 'devicevalues_id', 'triggering_reading_id', 'alert_state', 'id');
      await resolveRef(pg, 'notification_logs', 'device_value_id', 'telemetry_id', 'alert_log', 'id');

      // rebuild user_devices.last_reading* from the newest telemetry row per device
      await pg.query(`
        update user_devices ud set
          last_reading = sub.snap,
          last_reading_at = sub.created_at,
          last_reading_id = sub.id,
          last_dev_eui = sub.dev_eui
        from (
          select distinct on (user_device_id)
                 user_device_id, id, created_at, dev_eui,
                 jsonb_strip_nulls(jsonb_build_object(
                   'voltage', voltage, 'temperature', temperature, 'humidity', humidity,
                   'active_power', active_power, 'external_input', external_input,
                   'light', light, 'move', move, 'reed_state', reed_state,
                   'latitude', latitude, 'longitude', longitude, 'created_at', created_at
                 )) as snap
            from telemetry
           where user_device_id is not null
           order by user_device_id, created_at desc
        ) sub
        where ud.id = sub.user_device_id`);
      info('   last_reading rebuilt');
    }

    return {
      rowsLoaded: inserted,
      sourceRows: total,
      notes: `${inserted} rows written (${total - inserted} already present, ${skippedDup} dup/shadow skipped in-run); budget ${budgetMb}MB`,
    };
}

// ---------------------------------------------------------------------------
function cliVal(name: string): string | undefined {
  const i = process.argv.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (i === -1) return undefined;
  const a = process.argv[i];
  return a.includes('=') ? a.split('=')[1] : process.argv[i + 1];
}

function mysqlTs(v: unknown): string | null {
  const s = nz(v);
  if (!s) return null;
  if (s.startsWith('0000')) return null;
  const iso = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/.test(s) ? s.replace(' ', 'T') + 'Z' : s;
  const d = new Date(iso);
  return isNaN(+d) ? null : d.toISOString();
}

function toMongoTs(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return isNaN(+v) ? null : v.toISOString();
  // ObjectId → its timestamp
  if (typeof v === 'object' && v !== null && 'getTimestamp' in v && typeof (v as { getTimestamp: unknown }).getTimestamp === 'function') {
    return (v as { getTimestamp(): Date }).getTimestamp().toISOString();
  }
  const s = String(v).trim();
  if (!s) return null;
  const iso = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/.test(s) ? s.replace(' ', 'T') + 'Z' : s;
  const d = new Date(iso);
  return isNaN(+d) ? null : d.toISOString();
}

interface RowIn {
  created_at: string | null;
  updated_at: string | null;
  dev_eui: string | null;
  gateway_id: string | null;
  user_id: string | null;
  user_device_id: string | null;
  inventory_device_id: string | null;
  electrical: Record<string, unknown>;
  env: Record<string, unknown>;
  geo: Record<string, unknown>;
  raw_body: string | null;
  raw_packet: string | null;
  xup_encoded_edr: string | null;
  xup_decoded_edr: string | null;
  legacy_id: string | null;
  legacy_mongo_id: string | null;
  raw_source: string;
}

function mkRow(r: RowIn): unknown[] {
  const e = r.electrical;
  const created = r.created_at ?? new Date().toISOString();
  return [
    created,
    r.updated_at ?? created,
    r.dev_eui,
    r.gateway_id,
    r.user_id,
    r.user_device_id,
    r.inventory_device_id,
    num(e.energy_consumption_meter_consumed),
    num(e.energy_consumption_meter_elapsed),
    num(e.active_power),
    num(e.apparent_power),
    num(e.reactive_power),
    num(e.power_factor),
    num(e.voltage),
    num(e.current),
    num(r.env.humidity),
    num(r.env.temperature),
    num(r.env.luminosity),
    toBool(e.external_input),
    toBool(e.light),
    toBool(e.move),
    toInt(e.reed_state),
    toLat(r.geo.latitude),
    toLon(r.geo.longitude),
    toAlt(r.geo.altitude),
    r.raw_body,
    r.raw_packet,
    r.xup_encoded_edr,
    r.xup_decoded_edr,
    r.legacy_id,
    r.legacy_mongo_id,
    r.raw_source,
  ];
}

/**
 * Resolve a MySQL varchar column that stored a Mongo `_id` (or a MySQL
 * device_values id) into a telemetry FK on the migrated target table.
 */
async function resolveRef(
  pg: ReturnType<typeof pgPool>,
  srcTable: string,
  srcCol: string,
  tgtCol: string,
  tgtTable = srcTable === 'neo_alarm_logs' ? 'neo_alarm_logs' : srcTable,
  tgtKey = 'id',
): Promise<void> {
  // pull (id, rawref) from the SOURCE mysql table
  const refs: { id: string; raw: string }[] = [];
  for await (const row of mysqlStream<Record<string, unknown>>(
    `select id, \`${srcCol}\` as raw from ${srcTable} where \`${srcCol}\` is not null and \`${srcCol}\` <> ''`,
  )) {
    const raw = nz(row.raw);
    if (raw) refs.push({ id: String(row.id), raw });
  }
  if (refs.length === 0) return;

  // build a lookup: legacy_mongo_id | legacy_id -> telemetry.id
  // A single `= any($1)` with a huge array (~90k+ elements) makes the planner
  // choke on this table (observed: 5,000 refs ~1.3s, 90,000+ refs times out at
  // 60s+) — chunk the lookup instead. Dedupe first since many rows share refs.
  const CHUNK = 5000;
  const hexRefs = [...new Set(refs.filter((r) => /^[a-f0-9]{24}$/i.test(r.raw)).map((r) => r.raw))];
  const intRefs = [...new Set(refs.filter((r) => /^\d+$/.test(r.raw)).map((r) => r.raw))];
  const map = new Map<string, string>();
  for (let i = 0; i < hexRefs.length; i += CHUNK) {
    const slice = hexRefs.slice(i, i + CHUNK);
    for (const r of (await pg.query<{ m: string; id: string }>(
      `select legacy_mongo_id m, id::text id from telemetry where legacy_mongo_id = any($1)`, [slice],
    )).rows) map.set(r.m, r.id);
  }
  for (let i = 0; i < intRefs.length; i += CHUNK) {
    const slice = intRefs.slice(i, i + CHUNK);
    for (const r of (await pg.query<{ l: string; id: string }>(
      `select legacy_id::text l, id::text id from telemetry where legacy_id = any($1::bigint[])`, [slice],
    )).rows) map.set(r.l, r.id);
  }

  let resolved = 0;
  const updates = refs
    .map((r) => [r.id, map.get(r.raw)] as const)
    .filter((x): x is readonly [string, string] => !!x[1]);
  for (let i = 0; i < updates.length; i += 500) {
    const slice = updates.slice(i, i + 500);
    const params: unknown[] = [];
    const tuples = slice.map(([srcId, telId]) => {
      params.push(srcId, telId);
      return `($${params.length - 1}, $${params.length})`;
    }).join(',');
    await pg.query(
      `update ${tgtTable} t set ${tgtCol} = v.tel::bigint
         from (values ${tuples}) as v(src, tel)
        where t.${tgtKey}::text = v.src`,
      params,
    );
    resolved += slice.length;
  }
  if (resolved) info(`   ${tgtTable}.${tgtCol}: resolved ${resolved}/${refs.length}`);
  if (refs.length - resolved > 0) {
    unresolved(KEY, tgtTable, tgtCol, null, null, `${refs.length - resolved} refs unresolved (reading not in the loaded telemetry slice)`);
  }
}
