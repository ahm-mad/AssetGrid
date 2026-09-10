/**
 * Phase 5 — devices / inventory / charging (spec §4 group 5, §7).
 *
 *   subscription_entitlements  ← moved here from group 6: user_devices and
 *                                device_assignments both FK it (dependency order
 *                                wins over the spec's grouping — noted in ADRs).
 *   inventory_devices          ← inventory_devices  (LoRaWAN secrets split out)
 *   inventory_device_secrets   ← inventory_devices.{app_key,APPEUI,DEVADDR,
 *                                NWKSKEY,APPSKEY}  (A10 / ADR-025)
 *   user_devices               ← user_devices  (last_packet cache → last_reading*)
 *   device_parameters          ← device_parameters
 *   device_schedules           ← device_schedules
 *   sunset_rises               ← sunset_rises
 *   charging_timers            ← charging_timers (kind 'standard') +
 *                                quick_charging_timers (kind 'quick', id offset)
 *   device_charging_state      ← running_devices  (1 row per user_device_id)
 *   device_health_schedulers   ← device_health_schedulers
 *   device_assignments         ← device_assignments
 *   safeguard_configurations   ← safe_guard_configurations
 *   energy_usage_sessions      ← electric_energy_usages (resolve user_device_id
 *                                from dev_eui)
 */

import type { Phase, PhaseResult } from './types.ts';
import { mysqlAll } from '../lib/read.ts';
import { pgPool } from '../lib/sources.ts';
import { loadObjects, setval, upsert, truncate } from '../lib/load.ts';
import { loadIdMap, uid } from '../lib/idmap.ts';
import { unresolved } from '../lib/unresolved.ts';
import {
  toId, toTs, toTsN, nz, upper, toBool, toInt, toNum, jsonParam, toJsonParam,
} from '../lib/coerce.ts';

const KEY = '50-devices';
const QUICK_TIMER_ID_OFFSET = 1_000_000; // keep merged ids disjoint (both spaces start at 1)
const ENTITLEMENT_SOURCE = new Set(['stripe', 'admin', 'system']);
const PAYMENT_PROVIDER = new Set(['stripe', 'cash']);
const BILLING_MODE = new Set(['direct', 'dealer_assisted', 'dealer_billed']);
const ASSIGN_STATUS = new Set(['active', 'suspended', 'released', 'inactive']);

function ts(r: Record<string, unknown>) {
  return { created_at: toTs(r.created_at), updated_at: toTs(r.updated_at, r.created_at) };
}

export const phase: Phase = {
  key: KEY,
  title: 'Devices / inventory / charging',
  targetTables: [
    'energy_usage_sessions', 'safeguard_configurations', 'device_assignments',
    'device_health_schedulers', 'device_charging_state', 'charging_timers',
    'sunset_rises', 'device_schedules', 'device_parameters', 'user_devices',
    'inventory_device_secrets', 'inventory_devices', 'subscription_entitlements',
  ],

  async run(): Promise<PhaseResult> {
    await loadIdMap();
    const pg = pgPool();
    let loaded = 0;
    let source = 0;

    const has = async (table: string, col = 'id'): Promise<Set<string>> =>
      new Set((await pg.query<{ v: string }>(`select ${col}::text v from ${table}`)).rows.map((r) => r.v));

    const containerIds = await has('containers');
    const productIds = await has('products');
    const companyIds = await has('companies');
    const deviceTypeIds = await has('device_types');
    const planIds = await has('plans');
    const packageIds = await has('packages');
    const promoIds = await has('promo_codes');

    const fk = (val: unknown, set: Set<string>, table: string, col: string, rowId: unknown, nullable = true): string | null => {
      const id = toId(val);
      if (!id) return null;
      if (!set.has(id)) {
        unresolved(KEY, table, col, val, rowId, nullable ? 'unknown fk → null' : 'unknown fk (NOT NULL target!)');
        return null;
      }
      return id;
    };

    // ---- subscription_entitlements -------------------------------------
    {
      const src = await mysqlAll('select * from subscription_entitlements');
      source += src.length;
      const rows = (src as Record<string, unknown>[]).map((r) => {
        const srcVal = (nz(r.source) ?? 'system').toLowerCase();
        const pp = (nz(r.payment_provider) ?? 'stripe').toLowerCase();
        const bm = nz(r.billing_mode)?.toLowerCase() ?? null;
        if (!ENTITLEMENT_SOURCE.has(srcVal)) unresolved(KEY, 'subscription_entitlements', 'source', r.source, r.id, 'not in enum → system');
        if (bm && !BILLING_MODE.has(bm)) unresolved(KEY, 'subscription_entitlements', 'billing_mode', r.billing_mode, r.id, 'not in enum → null');
        return {
          id: toId(r.id),
          plan_id: fk(r.plan_id, planIds, 'subscription_entitlements', 'plan_id', r.id),
          user_id: uid(r.user_id),
          owner_xnid: nz(r.owner_xnid),
          billing_xnid: nz(r.billing_xnid),
          dealer_xnid: nz(r.dealer_xnid),
          billing_mode: bm && BILLING_MODE.has(bm) ? bm : null,
          source: ENTITLEMENT_SOURCE.has(srcVal) ? srcVal : 'system',
          payment_provider: PAYMENT_PROVIDER.has(pp) ? pp : 'stripe',
          provider_customer_id: nz(r.provider_customer_id),
          provider_subscription_id: nz(r.provider_subscription_id),
          max_devices_allowed: toInt(r.max_devices_allowed),
          active_device_count: toInt(r.active_device_count) ?? 0,
          status: nz(r.status) ?? 'active',
          started_at: toTsN(r.started_at),
          cancelled_at: toTsN(r.cancelled_at),
          ...ts(r),
        };
      });
      loaded += await loadObjects('subscription_entitlements', rows, {
        conflict: upsert('(id)', Object.keys(rows[0] ?? { id: 1 }), ['id']),
      });
      await setval('subscription_entitlements');
    }
    const entitlementIds = await has('subscription_entitlements');

    // ---- inventory_devices + secrets --------------------------------
    {
      const src = await mysqlAll('select * from inventory_devices');
      source += src.length;
      const devRows: Record<string, unknown>[] = [];
      const secretRows: Record<string, unknown>[] = [];
      for (const r of src as Record<string, unknown>[]) {
        const id = toId(r.id);
        devRows.push({
          id,
          name: nz(r.name) ?? '(unnamed)',
          description: nz(r.description),
          activation_code: nz(r.activation_code),
          dev_eui: upper(r.devEUI),
          container_id: fk(r.container_id, containerIds, 'inventory_devices', 'container_id', id, false),
          product_id: fk(r.product_id, productIds, 'inventory_devices', 'product_id', id, false),
          company_id: fk(r.company_id, companyIds, 'inventory_devices', 'company_id', id),
          xnid: nz(r.xNID),
          t_code: nz(r.T_Code),
          serial_number: nz(r.serial_number),
          part_number: nz(r.part_number),
          device_type_id: fk(r.device_type_id, deviceTypeIds, 'inventory_devices', 'device_type_id', id),
          ...ts(r),
        });
        if (nz(r.app_key) || nz(r.APPEUI) || nz(r.DEVADDR) || nz(r.NWKSKEY) || nz(r.APPSKEY)) {
          secretRows.push({
            inventory_device_id: id,
            app_key: nz(r.app_key),
            app_eui: nz(r.APPEUI),
            dev_addr: nz(r.DEVADDR),
            nwkskey: nz(r.NWKSKEY),
            appskey: nz(r.APPSKEY),
            updated_at: toTs(r.updated_at, r.created_at),
          });
        }
      }
      // NOT NULL FK failures would break the batch — drop those rows + log
      const bad = devRows.filter((d) => d.container_id === null || d.product_id === null);
      for (const d of bad) unresolved(KEY, 'inventory_devices', 'row', d.id, d.id, 'container_id/product_id unresolved — row dropped');
      const okRows = devRows.filter((d) => d.container_id !== null && d.product_id !== null);
      const okIds = new Set(okRows.map((d) => String(d.id)));
      loaded += await loadObjects('inventory_devices', okRows, {
        conflict: upsert('(id)', Object.keys(okRows[0] ?? { id: 1 }), ['id']),
      });
      await setval('inventory_devices');
      loaded += await loadObjects(
        'inventory_device_secrets',
        secretRows.filter((s) => okIds.has(String(s.inventory_device_id))),
        { conflict: upsert('(inventory_device_id)', ['inventory_device_id', 'app_key', 'app_eui', 'dev_addr', 'nwkskey', 'appskey', 'updated_at'], ['inventory_device_id']) },
      );
    }
    const inventoryIds = await has('inventory_devices');

    // ---- user_devices ---------------------------------------------
    {
      const src = await mysqlAll('select * from user_devices');
      source += src.length;
      const rows: Record<string, unknown>[] = [];
      for (const r of src as Record<string, unknown>[]) {
        const id = toId(r.id);
        const u = uid(r.user_id);
        if (!u) {
          unresolved(KEY, 'user_devices', 'user_id', r.user_id, id, 'user not resolved — row dropped (user_id is NOT NULL)');
          continue;
        }
        const status = nz(r.status) === 'captured' ? 'captured' : 'decline';
        rows.push({
          id,
          dev_eui: upper(r.devEUI),
          xnid: nz(r.xnid),
          device_location: nz(r.device_location),
          status,
          device_name: nz(r.device_name),
          device_activation_code: nz(r.device_activation_code),
          provider_subscription_id: nz(r.provider_subscription_id),
          session_id: nz(r.session_id),
          activation_status: nz(r.activation_status),
          activated_at: toTsN(r.activated_at),
          entitlement_id: fk(r.entitlement_id, entitlementIds, 'user_devices', 'entitlement_id', id),
          user_id: u,
          package_id: fk(r.package_id, packageIds, 'user_devices', 'package_id', id),
          promo_code_id: fk(r.promoCode_id, promoIds, 'user_devices', 'promoCode_id', id),
          inventory_device_id: fk(r.inventory_device_id, inventoryIds, 'user_devices', 'inventory_device_id', id),
          last_reading: jsonParam(r.last_packet_json),
          last_reading_at: null,
          last_reading_id: toId(r.dev_val_last_packet),
          last_dev_eui: upper(r.dev_eui_last_packet),
          notification_email: nz(r.notification_email),
          notification_phone_number: nz(r.notification_phone_number),
          toggle_status: toBool(r.toggle_status) ?? true,
          ...ts(r),
        });
      }
      loaded += await loadObjects('user_devices', rows, {
        conflict: upsert('(id)', Object.keys(rows[0] ?? { id: 1 }), ['id']),
      });
      await setval('user_devices');
    }
    const userDeviceIds = await has('user_devices');
    const udByDevEui = new Map<string, string>();
    for (const r of (await pg.query<{ id: string; dev_eui: string | null }>(
      'select id::text, dev_eui from user_devices where dev_eui is not null',
    )).rows) {
      udByDevEui.set(r.dev_eui!.toUpperCase(), r.id);
    }

    // ---- device_parameters -------------------------------------
    {
      const src = await mysqlAll('select * from device_parameters');
      source += src.length;
      const rows = (src as Record<string, unknown>[]).map((r) => ({
        id: toId(r.id),
        dev_eui: upper(r.devEUI),
        battery_voltage: toInt(r.battery_voltage),
        battery_capacity: toInt(r.battery_capacity),
        desired_charging: toInt(r.desired_charging),
        charging_limits: toInt(r.charging_limits),
        charger_voltage: toInt(r.charger_voltage),
        charger_amperes: toInt(r.charger_amperes),
        over_current_protection: toBool(r.over_current_protection) ?? true,
        over_voltage_protection: toBool(r.over_voltage_protection) ?? true,
        sms_alert: toBool(r.sms_alert) ?? true,
        email_alert: toBool(r.email_alert) ?? true,
        is_default: toBool(r.is_default) ?? false,
        user_id: uid(r.user_id),
        user_device_id: fk(r.user_device_id, userDeviceIds, 'device_parameters', 'user_device_id', r.id),
        inventory_device_id: fk(r.inventory_device_id, inventoryIds, 'device_parameters', 'inventory_device_id', r.id),
        ...ts(r),
      }));
      loaded += await loadObjects('device_parameters', rows, {
        conflict: upsert('(id)', rows.length ? Object.keys(rows[0]) : ['id'], ['id']),
      });
      await setval('device_parameters');
    }

    // ---- device_schedules + sunset_rises -----------------------
    for (const [srcT, tgtT, extra] of [
      ['device_schedules', 'device_schedules', null],
      ['sunset_rises', 'sunset_rises', null],
    ] as const) {
      const src = await mysqlAll(`select * from ${srcT}`);
      source += src.length;
      const rows = (src as Record<string, unknown>[]).map((r) => {
        const base: Record<string, unknown> = {
          id: toId(r.id),
          selected_days: toJsonParam(r.selected_days) ?? '[]',
          turn_on: toBool(r.turn_on) ?? true,
          reminder: toBool(r.reminder) ?? false,
          user_device_id: fk(r.user_device_id, userDeviceIds, tgtT, 'user_device_id', r.id),
          device_type_id: fk(r.device_type_id, deviceTypeIds, tgtT, 'device_type_id', r.id, false),
          ...ts(r),
        };
        if (srcT === 'device_schedules') {
          base.start_time = nz(r.start_time) ?? '00:00';
          base.end_time = nz(r.end_time) ?? '00:00';
        } else {
          base.sunrise = toInt(r.sunrise) ?? 0;
          base.sunset = toInt(r.sunset) ?? 0;
        }
        return base;
      });
      void extra;
      // sunset_rises.user_device_id / device_type_id are NOT NULL in target
      const okRows = tgtT === 'sunset_rises'
        ? rows.filter((r) => r.user_device_id !== null && r.device_type_id !== null)
        : rows.filter((r) => r.device_type_id !== null);
      if (okRows.length !== rows.length) {
        unresolved(KEY, tgtT, 'row', null, null, `${rows.length - okRows.length} rows dropped (NOT NULL fk unresolved)`);
      }
      loaded += await loadObjects(tgtT, okRows, {
        conflict: upsert('(id)', okRows.length ? Object.keys(okRows[0]) : ['id'], ['id']),
      });
      await setval(tgtT);
    }

    // ---- charging_timers (merged) ---------------------------
    {
      const std = await mysqlAll('select * from charging_timers');
      const quick = await mysqlAll('select * from quick_charging_timers');
      source += std.length + quick.length;
      const rows: Record<string, unknown>[] = [];
      for (const r of std as Record<string, unknown>[]) {
        rows.push({
          id: toId(r.id), kind: 'standard', seconds: toInt(r.time),
          is_active: toBool(r.status) ?? false,
          user_id: uid(r.user_id),
          user_device_id: fk(r.user_device_id, userDeviceIds, 'charging_timers', 'user_device_id', r.id),
          ...ts(r),
        });
      }
      for (const r of quick as Record<string, unknown>[]) {
        rows.push({
          id: String(QUICK_TIMER_ID_OFFSET + Number(toId(r.id))),
          kind: 'quick', seconds: toInt(r.charging_time),
          is_active: toBool(r.status) ?? false,
          user_id: uid(r.user_id),
          user_device_id: fk(r.user_device_id, userDeviceIds, 'charging_timers', 'user_device_id', r.id),
          ...ts(r),
        });
      }
      if (quick.length) unresolved(KEY, 'charging_timers', 'id', null, null, `quick_charging_timers ids offset by +${QUICK_TIMER_ID_OFFSET} to keep the merged id space disjoint (nothing FKs this table)`);
      loaded += await loadObjects('charging_timers', rows, {
        conflict: upsert('(id)', rows.length ? Object.keys(rows[0]) : ['id'], ['id']),
      });
      await setval('charging_timers');
    }

    // ---- device_charging_state (from running_devices) -------
    {
      const src = await mysqlAll('select * from running_devices order by id');
      source += src.length;
      const byUd = new Map<string, Record<string, unknown>>();
      for (const r of src as Record<string, unknown>[]) {
        const udId = fk(r.user_device_id, userDeviceIds, 'device_charging_state', 'user_device_id', r.id, false);
        if (!udId) continue;
        const st = nz(r.status)?.toLowerCase() ?? null;
        byUd.set(udId, {
          user_device_id: udId,
          dev_eui: upper(r.devEUI),
          is_on: st === 'on' ? true : st === 'off' ? false : null,
          is_charging: false,
          last_status: nz(r.status),
          last_command: null,
          last_command_at: null,
          user_id: uid(r.user_id),
          inventory_device_id: fk(r.inventory_device_id, inventoryIds, 'device_charging_state', 'inventory_device_id', r.id),
          updated_at: toTs(r.updated_at, r.created_at),
        });
      }
      loaded += await loadObjects('device_charging_state', [...byUd.values()], {
        conflict: upsert('(user_device_id)', ['user_device_id', 'dev_eui', 'is_on', 'is_charging', 'last_status', 'last_command', 'last_command_at', 'user_id', 'inventory_device_id', 'updated_at'], ['user_device_id']),
      });
    }

    // ---- device_health_schedulers -------------------------
    {
      const src = await mysqlAll('select * from device_health_schedulers');
      source += src.length;
      const rows: Record<string, unknown>[] = [];
      for (const r of src as Record<string, unknown>[]) {
        const u = uid(r.user_id);
        if (!u) { unresolved(KEY, 'device_health_schedulers', 'user_id', r.user_id, r.id, 'user not resolved — row dropped'); continue; }
        rows.push({
          id: toId(r.id), user_id: u,
          schedule_title: nz(r.schedule_title) ?? '(untitled)',
          time_zone: nz(r.time_zone) ?? 'UTC',
          time: nz(r.time) ?? '00:00',
          days: toJsonParam(r.days),
          selected_devices: toJsonParam(r.selected_devices),
          ...ts(r),
        });
      }
      loaded += await loadObjects('device_health_schedulers', rows, {
        conflict: upsert('(id)', rows.length ? Object.keys(rows[0]) : ['id'], ['id']),
      });
      await setval('device_health_schedulers');
    }

    // ---- device_assignments -----------------------------
    {
      const src = await mysqlAll('select * from device_assignments');
      source += src.length;
      const rows: Record<string, unknown>[] = [];
      for (const r of src as Record<string, unknown>[]) {
        const ent = fk(r.entitlement_id, entitlementIds, 'device_assignments', 'entitlement_id', r.id, false);
        if (!ent) { unresolved(KEY, 'device_assignments', 'entitlement_id', r.entitlement_id, r.id, 'entitlement not resolved — row dropped'); continue; }
        let st = nz(r.status)?.toLowerCase() ?? 'active';
        if (!ASSIGN_STATUS.has(st)) { unresolved(KEY, 'device_assignments', 'status', r.status, r.id, 'unknown status → active'); st = 'active'; }
        rows.push({
          id: toId(r.id), xnid: nz(r.xnid) ?? '',
          entitlement_id: ent,
          provider_subscription_id: nz(r.provider_subscription_id),
          status: st,
          assigned_at: toTs(r.assigned_at, r.created_at),
          ...ts(r),
        });
      }
      loaded += await loadObjects('device_assignments', rows, {
        conflict: upsert('(id)', rows.length ? Object.keys(rows[0]) : ['id'], ['id']),
      });
      await setval('device_assignments');
    }

    // ---- safeguard_configurations ---------------------
    {
      const src = await mysqlAll('select * from safe_guard_configurations');
      source += src.length;
      const rows = (src as Record<string, unknown>[]).map((r) => ({
        id: toId(r.id),
        user_id: uid(r.user_id),
        inventory_device_id: fk(r.inventory_device_id, inventoryIds, 'safeguard_configurations', 'inventory_device_id', r.id),
        user_device_id: fk(r.user_device_id, userDeviceIds, 'safeguard_configurations', 'user_device_id', r.id),
        abnormal_alert_limit: toInt(r.abnormal_alert_limit) ?? 3,
        alert_interval_hours: toNum(r.alert_interval_hours) ?? 24,
        support_email_sent: jsonParam(r.support_email_sent),
        support_number_sent: jsonParam(r.support_number_sent),
        is_active: toBool(r.globle_active_status) ?? true,
        notifications_paused: toBool(r.globle_notifications_paused) ?? false,
        support_email_sent_at: toTsN(r.support_email_sent_at),
        ...ts(r),
      }));
      loaded += await loadObjects('safeguard_configurations', rows, {
        conflict: upsert('(id)', rows.length ? Object.keys(rows[0]) : ['id'], ['id']),
      });
      await setval('safeguard_configurations');
    }

    // ---- energy_usage_sessions (from electric_energy_usages) ----
    {
      const src = await mysqlAll('select * from electric_energy_usages');
      source += src.length;
      const rows = (src as Record<string, unknown>[]).map((r) => ({
        id: toId(r.id),
        dev_eui: upper(r.devEUI) ?? '',
        user_device_id: udByDevEui.get(String(upper(r.devEUI))) ?? null,
        energy_consumed: toNum(r.energy_consumed),
        status: nz(r.status) ?? 'incomplete',
        counter: toInt(r.counter),
        ...ts(r),
      }));
      loaded += await loadObjects('energy_usage_sessions', rows, {
        conflict: upsert('(id)', rows.length ? Object.keys(rows[0]) : ['id'], ['id']),
      });
      await setval('energy_usage_sessions');
    }

    void truncate;
    return { rowsLoaded: loaded, sourceRows: source };
  },
};
