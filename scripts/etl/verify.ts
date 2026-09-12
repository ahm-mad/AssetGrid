/**
 * ETL reconciliation report (spec §10).
 *
 *   node scripts/etl/verify.ts [--json]
 *
 * 1. Row counts — source (MySQL/Mongo) vs target vs expected delta.
 * 2. FK integrity — orphan counts for every FK (must be 0).
 * 3. etl.unresolved — categorised summary for human sign-off.
 * 4. Auth — auth.users vs distinct deduped emails; every profile in the id map.
 * 5. Telemetry — per-source min/max date, table size vs budget.
 *
 * Read-only. Run after `etl.ts`.
 */

import { mysql, mongo, pgPool, closeAll } from './lib/sources.ts';
import { describeConfig } from './config.ts';

const asJson = process.argv.includes('--json');

interface CountRow {
  target: string;
  source: string; // mysql table / 'mongo' / '(merge)'
  srcCount: number | null;
  tgtCount: number;
  expectedDelta: string;
  status: string;
}

// target table  <-  source table(s)  [expected-delta note]
const MAP: [string, string | null, string][] = [
  ['role_types', 'role_types', '0'],
  ['modules', 'modules', '0'],
  ['device_types', 'device_types', '0'],
  ['xups', 'xups', '0'],
  ['notifies', 'notifies', '0'],
  ['vendors', 'vendors', '0'],
  ['packages', 'packages', '0'],
  ['promo_codes', 'promo_codes', '0'],
  ['containers', 'containers', '0'],
  ['domains', 'domains', '0'],
  ['companies', 'companies', '0'],
  ['apps', 'apps', '0'],
  ['profiles', 'users', '-N (email dedupe → etl.user_merges)'],
  ['profile_details', 'detail_users', '-losers, -users-without-detail'],
  ['role_permissions', 'permissions', '-duplicates (B15 dedupe)'],
  ['user_permissions', 'user_permissions', '0'],
  ['user_scopes', 'user_scopes', '0'],
  ['attributes', 'attributes', '0'],
  ['app_xup', 'app_xup', '-unresolved fk'],
  ['plans', 'plans', '0'],
  ['products', 'products', '0'],
  ['user_xup_preferences', 'user_xup_preferences', '-unresolved user/product'],
  ['subscription_entitlements', 'subscription_entitlements', '0'],
  ['inventory_devices', 'inventory_devices', '-unresolved NOT NULL fk'],
  ['inventory_device_secrets', null, '(rows of inventory_devices with any LoRaWAN key)'],
  ['user_devices', 'user_devices', '-unresolved user_id'],
  ['device_parameters', 'device_parameters', '0'],
  ['device_schedules', 'device_schedules', '-unresolved device_type'],
  ['sunset_rises', 'sunset_rises', '-unresolved NOT NULL fk'],
  ['charging_timers', null, 'charging_timers + quick_charging_timers'],
  ['device_charging_state', 'running_devices', '-dup user_device_id (kept latest)'],
  ['device_health_schedulers', 'device_health_schedulers', '-unresolved user'],
  ['device_assignments', 'device_assignments', '-unresolved entitlement'],
  ['safeguard_configurations', 'safe_guard_configurations', '0'],
  ['energy_usage_sessions', 'electric_energy_usages', '0'],
  ['activation_attempts', 'activation_attempts', '-unresolved plan'],
  ['activation_attempt_devices', 'activation_attempt_devices', '-unresolved attempt'],
  ['payments', 'payments', '0'],
  ['payment_details', 'payment_details', '-unresolved payment'],
  ['stripe_events', 'stripe_events', '0'],
  ['buildings', 'buildings', '0'],
  ['floors', 'floors', '-unresolved building'],
  ['units', 'units', '-unresolved floor'],
  ['areas', 'areas', '-unresolved unit'],
  ['sites', 'sites', '-unresolved building/area'],
  ['marinas', 'marinas', '0'],
  ['docks', 'docks', '-unresolved marina'],
  ['slips', 'slips', '-unresolved dock'],
  ['boats', null, 'boats + unassign_boats'],
  ['boat_devices', null, '(boats.inventory_device_id JSON, filtered to real ids)'],
  ['rate_plans', 'rate_plans', '-unresolved marina'],
  ['quotes', 'quotes', '0'],
  ['reservations', 'reservations', '0'],
  ['contracts', 'contracts', '-unresolved NOT NULL fk'],
  ['contract_amendments', 'contract_amendments', '-unresolved contract'],
  ['assignments', 'assignments', '-unresolved NOT NULL fk'],
  ['stays', 'stays', '-unresolved NOT NULL fk'],
  ['pos_transactions', null, 'pos_transactions + pos_sales'],
  ['invoices', 'invoices', '0'],
  ['ledgers', 'ledgers', '0'],
  ['meters', 'meters', '-unresolved slip'],
  ['notification_prefs', 'notifications', '0'],
  ['alert_windows', 'notification_schedulers', '0'],
  ['alert_rules', 'customer_notifie_rules', '-unresolved user'],
  ['device_notification_recipients', 'notification_addresses', '0'],
  ['alert_state', 'xup_notification_info', '-unresolved devEUI, -dedupe (device,attr)'],
  ['alert_log', 'notification_logs', '0'],
  ['neo_alarm_logs', 'neo_alarm_logs', '0'],
  ['telemetry', null, '-the subset cut (ADR-029): Mongo all + recent MySQL slice'],
];

async function mysqlCount(table: string): Promise<number | null> {
  try {
    const [rows] = await mysql().query<import('mysql2').RowDataPacket[]>(
      `select count(*) c from \`${table}\``,
    );
    return Number(rows[0].c);
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  console.log('assetgrid ETL — reconciliation\n' + describeConfig() + '\n');
  const pg = pgPool();

  // ---- 1. row counts ----------------------------------------------------
  const counts: CountRow[] = [];
  for (const [target, srcTable, delta] of MAP) {
    const { rows } = await pg.query<{ c: string }>(`select count(*)::text c from ${target}`);
    const tgt = Number(rows[0].c);
    let src: number | null = null;
    if (target === 'telemetry') {
      src = null;
    } else if (srcTable) {
      src = await mysqlCount(srcTable);
    } else if (target === 'charging_timers') {
      src = ((await mysqlCount('charging_timers')) ?? 0) + ((await mysqlCount('quick_charging_timers')) ?? 0);
    } else if (target === 'boats') {
      src = ((await mysqlCount('boats')) ?? 0) + ((await mysqlCount('unassign_boats')) ?? 0);
    } else if (target === 'pos_transactions') {
      src = ((await mysqlCount('pos_transactions')) ?? 0) + ((await mysqlCount('pos_sales')) ?? 0);
    }
    const status = src == null ? '—' : src === tgt ? 'exact' : tgt < src ? `-${src - tgt}` : `+${tgt - src}`;
    counts.push({ target, source: srcTable ?? '(merge)', srcCount: src, tgtCount: tgt, expectedDelta: delta, status });
  }

  // ---- 2. FK orphans --------------------------------------------------
  const { rows: fkRows } = await pg.query<{
    child: string; col: string; parent: string; pcol: string;
  }>(`
    select cl.relname child, att.attname col, pcl.relname parent, patt.attname pcol
      from pg_constraint con
      join pg_class cl on cl.oid = con.conrelid
      join pg_namespace n on n.oid = cl.relnamespace and n.nspname = 'public'
      join pg_class pcl on pcl.oid = con.confrelid
      join pg_namespace pn on pn.oid = pcl.relnamespace and pn.nspname = 'public'
      join pg_attribute att on att.attrelid = con.conrelid and att.attnum = con.conkey[1]
      join pg_attribute patt on patt.attrelid = con.confrelid and patt.attnum = con.confkey[1]
     where con.contype = 'f' and array_length(con.conkey, 1) = 1
       and cl.relispartition = false
     order by 1, 2`);
  const orphans: { fk: string; count: number }[] = [];
  for (const f of fkRows) {
    const { rows } = await pg.query<{ c: string }>(
      `select count(*)::text c from public."${f.child}" c
        where c."${f.col}" is not null
          and not exists (select 1 from public."${f.parent}" p where p."${f.pcol}" = c."${f.col}")`,
    );
    const n = Number(rows[0].c);
    if (n > 0) orphans.push({ fk: `${f.child}.${f.col} → ${f.parent}`, count: n });
  }

  // ---- 3. unresolved ------------------------------------------------
  const { rows: unres } = await pg.query<{ phase: string; t: string; c: string; reason: string; n: string }>(
    `select phase, table_name t, column_name c, reason, count(*)::text n
       from etl.unresolved group by 1,2,3,4 order by count(*) desc`,
  );

  // ---- 4. auth ---------------------------------------------------
  const distinctEmails = await mysqlCount('users'); // adjusted below
  const [dupRows] = await mysql().query<import('mysql2').RowDataPacket[]>(
    `select count(*) g from (select lower(email) e from users group by 1 having count(*) > 1) x`,
  );
  const [collisionExtra] = await mysql().query<import('mysql2').RowDataPacket[]>(
    `select coalesce(sum(c-1),0) extra from (select count(*) c from users group by lower(email) having count(*)>1) x`,
  );
  const expectedAuth = (distinctEmails ?? 0) - Number(collisionExtra[0].extra);
  const { rows: authCount } = await pg.query<{ c: string }>(
    `select count(*)::text c from auth.users where raw_app_meta_data ? 'legacy_id'`,
  );
  const { rows: mapCount } = await pg.query<{ c: string }>('select count(*)::text c from etl.user_id_map');
  const { rows: profNoMap } = await pg.query<{ c: string }>(
    `select count(*)::text c from profiles p where p.legacy_id is not null
       and not exists (select 1 from etl.user_id_map m where m.legacy_id = p.legacy_id)`,
  );

  // ---- 5. telemetry ----------------------------------------------
  const { rows: telStats } = await pg.query<{ raw_source: string; n: string; mn: string; mx: string }>(
    `select raw_source, count(*)::text n, min(created_at)::text mn, max(created_at)::text mx
       from telemetry group by raw_source order by raw_source`,
  );
  const { rows: telSize } = await pg.query<{ mb: string }>(
    `select round(pg_total_relation_size('public.telemetry')/1048576.0, 1)::text mb`,
  );
  let mongoTotal: number | null = null;
  try { mongoTotal = await (await mongo()).collection('device_values').estimatedDocumentCount(); } catch { /* offline */ }

  // ---- output ---------------------------------------------------
  if (asJson) {
    console.log(JSON.stringify({ counts, orphans, unresolved: unres, auth: { expectedAuth, actual: Number(authCount[0].c), map: Number(mapCount[0].c), profilesNotInMap: Number(profNoMap[0].c) }, telemetry: { bySource: telStats, sizeMb: telSize[0].mb, mongoSource: mongoTotal } }, null, 2));
  } else {
    console.log('── ROW COUNTS ' + '─'.repeat(60));
    console.log('target'.padEnd(30) + 'source'.padEnd(26) + 'src'.padStart(8) + 'tgt'.padStart(8) + '  delta / expected');
    for (const r of counts) {
      console.log(
        r.target.padEnd(30) + r.source.padEnd(26) +
        String(r.srcCount ?? '—').padStart(8) + String(r.tgtCount).padStart(8) +
        `  ${r.status.padEnd(8)} ${r.expectedDelta}`,
      );
    }
    console.log('\n── FK ORPHANS ' + '─'.repeat(60));
    console.log(orphans.length === 0 ? '  none — all FK columns resolve ✓' : orphans.map((o) => `  ✗ ${o.fk}: ${o.count}`).join('\n'));

    console.log('\n── etl.unresolved ' + '─'.repeat(56));
    console.log(unres.length === 0 ? '  none' : unres.map((u) => `  ${u.n.padStart(6)}  ${u.phase}  ${u.t}.${u.c} — ${u.reason}`).join('\n'));

    console.log('\n── AUTH ' + '─'.repeat(66));
    console.log(`  expected auth.users (deduped emails): ${expectedAuth}`);
    console.log(`  actual ETL auth.users:               ${authCount[0].c}`);
    console.log(`  etl.user_id_map rows:                ${mapCount[0].c}  (keepers + merge losers)`);
    console.log(`  email collision groups:              ${dupRows[0].g}`);
    console.log(`  profiles missing from id map:        ${profNoMap[0].c}  ${Number(profNoMap[0].c) === 0 ? '✓' : '✗'}`);

    console.log('\n── TELEMETRY ' + '─'.repeat(61));
    console.log(`  table size: ${telSize[0].mb} MB` + (mongoTotal != null ? `   (Mongo source: ${mongoTotal} docs)` : ''));
    for (const t of telStats) console.log(`  ${t.raw_source.padEnd(28)} ${t.n.padStart(9)}   ${t.mn?.slice(0, 10)} → ${t.mx?.slice(0, 10)}`);
    if (telStats.length === 0) console.log('  (telemetry not yet loaded — phase 99)');
  }
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => closeAll());
