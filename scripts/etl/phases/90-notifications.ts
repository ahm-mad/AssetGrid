/**
 * Phase 9 — notifications / alert engine state (spec §4 group 9, §7).
 *
 *   notification_prefs             ← notifications (varchar toggles → bool)
 *   alert_windows                  ← notification_schedulers (marina_id/
 *                                    company_id varchar → bigint FK; days → text[])
 *   alert_rules                    ← customer_notifie_rules (status → is_active)
 *   device_notification_recipients ← notification_addresses (CSV → text[])
 *   alert_state                    ← xup_notification_info: resolve user_device_id
 *                                    from devEUI (mostly via inventory_devices),
 *                                    dedupe (user_device_id, attribute_id)
 *   alert_log                      ← notification_logs (~90k; audit — best effort)
 *   neo_alarm_logs                 ← neo_alarm_logs
 *
 * telemetry_id / triggering_reading_id references to Mongo `_id`s are left null
 * here and resolved by phase 99 (post-telemetry) via telemetry.legacy_mongo_id.
 */

import type { Phase, PhaseResult } from './types.ts';
import { mysqlAll } from '../lib/read.ts';
import { pgPool } from '../lib/sources.ts';
import { loadObjects, loadRows, setval, upsert, truncate } from '../lib/load.ts';
import { loadIdMap, uid } from '../lib/idmap.ts';
import { unresolved } from '../lib/unresolved.ts';
import { args } from '../config.ts';
import {
  toId, toTs, toTsN, nz, toBool, toInt, upper, toTime, toTextArray, toStrArray, jsonParam,
} from '../lib/coerce.ts';

const KEY = '90-notifications';
const RECURRENCE = new Set(['daily', 'weekly', 'bi-weekly']);
const NEO_STATUS = new Set(['pending', 'success', 'failed', 'partial']);
const CHANNEL = new Set(['email', 'sms']);

function ts(r: Record<string, unknown>) {
  return { created_at: toTs(r.created_at), updated_at: toTs(r.updated_at, r.created_at) };
}

export const phase: Phase = {
  key: KEY,
  title: 'Notifications / alert-engine state',
  targetTables: [
    'alert_log', 'alert_state', 'neo_alarm_logs', 'device_notification_recipients',
    'alert_rules', 'alert_windows', 'notification_prefs',
  ],

  async run(): Promise<PhaseResult> {
    await loadIdMap();
    const pg = pgPool();
    let loaded = 0;
    let source = 0;

    const setOf = async (sql: string): Promise<Set<string>> =>
      new Set((await pg.query<{ v: string }>(sql)).rows.map((r) => r.v));
    const userDeviceIds = await setOf('select id::text v from user_devices');
    const buildingIds = await setOf('select id::text v from buildings');
    const marinaIds = await setOf('select id::text v from marinas');
    const companyIds = await setOf('select id::text v from companies');
    const productIds = await setOf('select id::text v from products');
    const notifieIds = await setOf('select id::text v from notifies');
    const inventoryIds = await setOf('select id::text v from inventory_devices');

    // devEUI → user_device_id: direct, then via inventory_devices
    const udByEui = new Map<string, string>();
    for (const r of (await pg.query<{ id: string; e: string }>(
      "select id::text, upper(dev_eui) e from user_devices where dev_eui is not null and dev_eui <> ''",
    )).rows) udByEui.set(r.e, r.id);
    for (const r of (await pg.query<{ ud: string; e: string }>(
      `select ud.id::text ud, upper(i.dev_eui) e
         from inventory_devices i join user_devices ud on ud.inventory_device_id = i.id
        where i.dev_eui is not null and i.dev_eui <> ''`,
    )).rows) if (!udByEui.has(r.e)) udByEui.set(r.e, r.ud);

    const fk = (val: unknown, set: Set<string>, table: string, col: string, rowId: unknown): string | null => {
      const id = toId(val);
      if (!id) return null;
      if (!set.has(id)) {
        unresolved(KEY, table, col, val, rowId, 'unknown fk → null');
        return null;
      }
      return id;
    };

    // ---- notification_prefs ----------------------------------------
    {
      const src = await mysqlAll('select * from notifications');
      source += src.length;
      const rows = (src as Record<string, unknown>[]).map((r) => ({
        id: toId(r.id),
        user_id: uid(r.user_id),
        user_device_id: fk(r.user_device_id, userDeviceIds, 'notification_prefs', 'user_device_id', r.id),
        company_id: fk(r.company_id, companyIds, 'notification_prefs', 'company_id', r.id),
        email_enabled: toBool(r.email_notification) ?? false,
        phone_enabled: toBool(r.phone_notification) ?? false,
        customer_phone_enabled: toBool(r.customer_phone_notification) ?? false,
        customer_email_enabled: toBool(r.customer_email_notification) ?? false,
        manager_phone_enabled: toBool(r.manager_phone_notification) ?? false,
        manager_email_enabled: toBool(r.manager_email_notification) ?? false,
        device_phone_enabled: toBool(r.device_phone_notification) ?? false,
        device_email_enabled: toBool(r.device_email_notification) ?? false,
        ...ts(r),
      }));
      loaded += await loadObjects('notification_prefs', rows, { conflict: upsert('(id)', rows.length ? Object.keys(rows[0]) : ['id'], ['id']) });
      await setval('notification_prefs');
    }

    // ---- alert_windows -----------------------------------------
    {
      const src = await mysqlAll('select * from notification_schedulers');
      source += src.length;
      const rows = (src as Record<string, unknown>[]).map((r) => {
        let rec = nz(r.recurrence)?.toLowerCase() ?? 'weekly';
        if (!RECURRENCE.has(rec)) { unresolved(KEY, 'alert_windows', 'recurrence', r.recurrence, r.id, '→ weekly'); rec = 'weekly'; }
        return {
          id: toId(r.id),
          rule_name: nz(r.rule_name),
          building_id: fk(r.building_id, buildingIds, 'alert_windows', 'building_id', r.id),
          marina_id: fk(r.marina_id, marinaIds, 'alert_windows', 'marina_id', r.id),
          company_id: fk(r.company_id, companyIds, 'alert_windows', 'company_id', r.id),
          attribute_key: nz(r.attribute_key) ?? '',
          inventories: jsonParam(r.inventories),
          days: Array.isArray(r.days)
            ? (r.days as unknown[]).map(String)
            : toStrArray(r.days),
          recurrence: rec,
          start_time: toTime(r.start_time) ?? '00:00:00',
          end_time: toTime(r.end_time) ?? '23:59:00',
          timezone: nz(r.timezone) ?? 'UTC',
          ...ts(r),
        };
      });
      loaded += await loadObjects('alert_windows', rows, { conflict: upsert('(id)', rows.length ? Object.keys(rows[0]) : ['id'], ['id']) });
      await setval('alert_windows');
    }

    // ---- alert_rules ----------------------------------------
    {
      const src = await mysqlAll('select * from customer_notifie_rules');
      source += src.length;
      const rows: Record<string, unknown>[] = [];
      for (const r of src as Record<string, unknown>[]) {
        const u = uid(r.user_id);
        if (!u) { unresolved(KEY, 'alert_rules', 'user_id', r.user_id, r.id, 'user not resolved — row dropped'); continue; }
        rows.push({
          id: toId(r.id), title: nz(r.title),
          is_active: toBool(r.status) ?? true,
          user_id: u,
          devices: jsonParam(r.devices),
          conditions: jsonParam(r.conditions),
          notifie: nz(r.notifie),
          ...ts(r),
        });
      }
      loaded += await loadObjects('alert_rules', rows, { conflict: upsert('(id)', rows.length ? Object.keys(rows[0]) : ['id'], ['id']) });
      await setval('alert_rules');
    }

    // ---- device_notification_recipients ------------------
    {
      const src = await mysqlAll('select * from notification_addresses');
      source += src.length;
      const rows = (src as Record<string, unknown>[]).map((r) => ({
        id: toId(r.id),
        user_id: uid(r.user_id),
        user_device_id: fk(r.user_device_id, userDeviceIds, 'device_notification_recipients', 'user_device_id', r.id),
        emails: toTextArray(r.emails) ?? [],
        phone_numbers: toTextArray(r.phone_numbers) ?? [],
        ...ts(r),
      }));
      loaded += await loadObjects('device_notification_recipients', rows, { conflict: upsert('(id)', rows.length ? Object.keys(rows[0]) : ['id'], ['id']) });
      await setval('device_notification_recipients');
    }

    // ---- alert_state (from xup_notification_info) -------
    {
      const src = await mysqlAll('select * from xup_notification_info order by updated_at desc, id desc');
      source += src.length;
      const attrIds = await setOf('select id::text v from attributes');
      const byKey = new Map<string, Record<string, unknown>>();
      let dropped = 0;
      for (const r of src as Record<string, unknown>[]) {
        const eui = upper(r.devEUI);
        const udId = eui ? udByEui.get(eui) : undefined;
        if (!udId) {
          unresolved(KEY, 'alert_state', 'devEUI', r.devEUI, r.id, 'no user_device for devEUI — row dropped (user_device_id NOT NULL)');
          dropped++;
          continue;
        }
        const attr = fk(r.attribute_id, attrIds, 'alert_state', 'attribute_id', r.id);
        const key = `${udId}|${attr ?? 'null'}`;
        if (byKey.has(key)) { dropped++; continue; } // ordered newest-first; keep first
        const ntype = nz(r.notification_type);
        byKey.set(key, {
          id: toId(r.id),
          user_device_id: udId,
          attribute_id: attr,
          dev_eui: eui,
          product_id: fk(r.product_id, productIds, 'alert_state', 'product_id', r.id),
          notifie_id: fk(r.notifie_id, notifieIds, 'alert_state', 'notifie_id', r.id),
          inventory_device_id: fk(r.inventory_device_id, inventoryIds, 'alert_state', 'inventory_device_id', r.id),
          value: null,
          prev_value: null,
          is_alert: false,
          notification: nz(r.notification),
          notification_type: ntype && ntype !== '' ? ntype : 'normal',
          admin_bypass: toBool(r.active_status) ?? false,
          alerts_count_24h: toInt(r.alerts_count_24h) ?? 0,
          window_started_at: toTsN(r.window_started_at),
          last_alert_at: toTsN(r.last_alert_time),
          paused_until: toTsN(r.paused_until),
          notifications_paused: toBool(r.notifications_paused) ?? false,
          support_email_sent_at: toTsN(r.support_email_sent_at),
          triggering_reading_id: null, // resolved in phase 99 via legacy_mongo_id
          ...ts(r),
        });
      }
      const rows = [...byKey.values()];
      loaded += await loadObjects('alert_state', rows, { conflict: upsert('(id)', rows.length ? Object.keys(rows[0]) : ['id'], ['id']) });
      await setval('alert_state');
      if (dropped) unresolved(KEY, 'alert_state', '*', null, null, `${dropped} rows dropped (unresolved devEUI or dedupe on user_device_id+attribute_id)`);
    }

    // ---- alert_log (from notification_logs, ~90k) -------
    {
      const src = await mysqlAll('select * from notification_logs', [], { cap: !!args.limit });
      source += src.length;
      const rows: unknown[][] = [];
      const cols = ['id', 'user_id', 'telemetry_id', 'device_name', 'user_device_id', 'channel', 'recipient', 'message', 'subject', 'created_at'];
      for (const r of src as Record<string, unknown>[]) {
        let channel = nz(r.type)?.toLowerCase() ?? 'email';
        if (!CHANNEL.has(channel)) channel = 'email';
        const udRaw = toId(r.user_device_id);
        const udId = udRaw && userDeviceIds.has(udRaw) ? udRaw : null;
        rows.push([
          toId(r.id),
          uid(r.user_id),
          null, // telemetry_id — device_value_id is a Mongo _id; phase 99 resolves it
          nz(r.device_name),
          udId,
          channel,
          nz(r.recipient) ?? '',
          nz(r.message) ?? '',
          nz(r.subject),
          toTs(r.created_at),
        ]);
      }
      loaded += await loadRows('alert_log', rows, { columns: cols, conflict: 'ignore', batchSize: 1000 });
      await setval('alert_log');
    }

    // ---- neo_alarm_logs -------------------------------
    {
      const src = await mysqlAll('select * from neo_alarm_logs');
      source += src.length;
      const rows = (src as Record<string, unknown>[]).map((r) => {
        let st = nz(r.status)?.toLowerCase() ?? 'pending';
        if (!NEO_STATUS.has(st)) st = 'pending';
        return {
          id: toId(r.id),
          telemetry_id: null, // device_value_id is a Mongo _id — phase 99 resolves
          account_code: nz(r.account_code) ?? '',
          point: toInt(r.point) ?? 0,
          cid_code: nz(r.cid_code) ?? '',
          event_code: nz(r.event_code) ?? '',
          cid_sent: toBool(r.cid_sent) ?? false,
          cid_sent_at: toTsN(r.cid_sent_at),
          cid_payload: nz(r.cid_payload),
          uc_sent: toBool(r.uc_sent) ?? false,
          uc_sent_at: toTsN(r.uc_sent_at),
          uc_payload: jsonParam(r.uc_payload),
          status: st,
          error_message: nz(r.error_message),
          ...ts(r),
        };
      });
      loaded += await loadObjects('neo_alarm_logs', rows, { conflict: upsert('(id)', rows.length ? Object.keys(rows[0]) : ['id'], ['id']) });
      await setval('neo_alarm_logs');
    }

    void truncate;
    return { rowsLoaded: loaded, sourceRows: source };
  },
};
