/**
 * Phase 4 — catalog (spec §4 group 4, §9 of schema-postgres.md).
 *
 *   attributes           ← attributes (alertMessage→alert_message,
 *                          is_event_code→neo_event_code, checkin varchar→bool)
 *   app_xup              ← app_xup (pivot)
 *   plans                ← plans (billing_modes JSON→billing_mode[], soft delete)
 *   products             ← products (TRIMMED — ~28 OpenCart columns dropped, B14)
 *   product_plans        ← products.plan_id JSON array → pivot
 *   user_xup_preferences ← user_xup_preferences + real FKs; drop rows whose
 *                          user_id / product_id don't resolve (§6.2)
 *
 * attributes / app_xup are already seeded; this UPSERTs from source.
 */

import type { Phase, PhaseResult } from './types.ts';
import { mysqlAll } from '../lib/read.ts';
import { pgPool } from '../lib/sources.ts';
import { loadObjects, setval, upsert } from '../lib/load.ts';
import { loadIdMap, uid } from '../lib/idmap.ts';
import { unresolved } from '../lib/unresolved.ts';
import {
  toId, toTs, nz, toBool, toMoney, jsonParam, toInt,
} from '../lib/coerce.ts';

const KEY = '40-catalog';
const BILLING_MODES = new Set(['direct', 'dealer_assisted', 'dealer_billed']);

function ts(r: Record<string, unknown>) {
  return { created_at: toTs(r.created_at), updated_at: toTs(r.updated_at, r.created_at) };
}

export const phase: Phase = {
  key: KEY,
  title: 'Catalog — attributes, app_xup, plans, products, product_plans, user_xup_preferences',
  targetTables: ['user_xup_preferences', 'product_plans'],

  async run(): Promise<PhaseResult> {
    await loadIdMap();
    const pg = pgPool();
    let loaded = 0;
    let source = 0;

    const notifieIds = new Set((await pg.query<{ id: string }>('select id::text from notifies')).rows.map((r) => r.id));
    const xupIds = new Set((await pg.query<{ id: string }>('select id::text from xups')).rows.map((r) => r.id));
    const appIds = new Set((await pg.query<{ id: string }>('select id::text from apps')).rows.map((r) => r.id));
    const companyIds = new Set((await pg.query<{ id: string }>('select id::text from companies')).rows.map((r) => r.id));
    const domainIds = new Set((await pg.query<{ id: string }>('select id::text from domains')).rows.map((r) => r.id));
    const deviceTypeIds = new Set((await pg.query<{ id: string }>('select id::text from device_types')).rows.map((r) => r.id));
    const vendorIds = new Set((await pg.query<{ id: string }>('select id::text from vendors')).rows.map((r) => r.id));

    const fk = (val: unknown, set: Set<string>, table: string, col: string, rowId: unknown): string | null => {
      const id = toId(val);
      if (!id) return null;
      if (!set.has(id)) {
        unresolved(KEY, table, col, val, rowId, 'unknown fk → null');
        return null;
      }
      return id;
    };

    // ---- attributes ----------------------------------------------------
    {
      const src = await mysqlAll('select * from attributes');
      source += src.length;
      const rows = (src as Record<string, unknown>[]).map((r) => ({
        id: toId(r.id),
        subject: nz(r.subject),
        alert_message: nz(r.alertMessage),
        threshold: nz(r.threshold),
        comparison: nz(r.comparison) ?? '=',
        checkin: toBool(r.checkin) ?? false,
        notifie_id: fk(r.notifie_id, notifieIds, 'attributes', 'notifie_id', r.id) ?? toId(r.notifie_id),
        xup_id: fk(r.xup_id, xupIds, 'attributes', 'xup_id', r.id),
        description: nz(r.description),
        alert_channel: nz(r.alert_channel) ?? '0',
        neo_event_code: nz(r.is_event_code),
        ...ts(r),
      }));
      loaded += await loadObjects('attributes', rows, {
        conflict: upsert('(id)', Object.keys(rows[0] ?? { id: 1 }), ['id']),
      });
      await setval('attributes');
    }

    // ---- app_xup -----------------------------------------------------
    {
      const src = await mysqlAll('select * from app_xup');
      source += src.length;
      const rows = (src as Record<string, unknown>[])
        .filter((r) => appIds.has(String(r.app_id)) && xupIds.has(String(r.xup_id)))
        .map((r) => ({ id: toId(r.id), app_id: toId(r.app_id), xup_id: toId(r.xup_id), ...ts(r) }));
      loaded += await loadObjects('app_xup', rows, { conflict: upsert('(id)', ['id', 'app_id', 'xup_id', 'created_at', 'updated_at'], ['id']) });
      await setval('app_xup');
    }

    // ---- plans -----------------------------------------------------
    {
      const src = await mysqlAll('select * from plans');
      source += src.length;
      const rows = (src as Record<string, unknown>[]).map((r) => {
        let modes = jsonParam(r.billing_modes);
        const parsed: unknown = modes ? JSON.parse(modes) : [];
        const modeArr = Array.isArray(parsed)
          ? parsed.map(String).filter((m) => {
              if (BILLING_MODES.has(m)) return true;
              unresolved(KEY, 'plans', 'billing_modes', m, r.id, 'unknown billing_mode dropped');
              return false;
            })
          : [];
        return {
          id: toId(r.id),
          plan_code: nz(r.plan_code),
          name: nz(r.name),
          plan_family: nz(r.plan_family) ?? 'consumer',
          tags: nz(r.tags),
          device_limit: toInt(r.device_limit) ?? 1,
          activation_type: nz(r.activation_type) ?? 'Single',
          max_devices_per_batch: toInt(r.max_devices_per_batch),
          requires_provisioning: toBool(r.requires_provisioning) ?? false,
          stripe_product_id: nz(r.stripe_product_id),
          stripe_price_id: nz(r.stripe_price_id),
          provisioning_price_id: nz(r.provisioning_price_id),
          xero_revenue_code: nz(r.xero_revenue_code),
          xero_account_code: nz(r.xero_account_code),
          billing_modes: modeArr, // text[] bind → billing_mode[]
          amount: toMoney(r.amount),
          billing_interval: nz(r.billing_interval),
          billing_type: nz(r.billing_type) ?? 'one_time',
          is_active: toBool(r.is_active) ?? true,
          notes: nz(r.notes),
          deleted_at: nz(r.deleted_at) ? toTs(r.deleted_at) : null,
          ...ts(r),
        };
      });
      loaded += await loadObjects('plans', rows, {
        conflict: upsert('(id)', Object.keys(rows[0] ?? { id: 1 }), ['id']),
      });
      await setval('plans');
    }

    // ---- products (trimmed) + product_plans -------------------------
    {
      const src = await mysqlAll('select * from products');
      source += src.length;
      const productRows: Record<string, unknown>[] = [];
      const planPivot: Record<string, unknown>[] = [];
      const planIds = new Set((await pg.query<{ id: string }>('select id::text from plans')).rows.map((r) => r.id));
      for (const r of src as Record<string, unknown>[]) {
        productRows.push({
          id: toId(r.id),
          product_name: nz(r.product_name),
          product_description: nz(r.product_description) ?? nz(r.description),
          model: nz(r.model),
          sku: nz(r.SKU),
          price: toMoney(r.price),
          status: toBool(r.status) ?? false,
          device_id: nz(r.device_id),
          image: nz(r.image),
          sort_order: toInt(r.sort_order),
          dimensions: jsonParam(r.dimensions),
          app_id: fk(r.app_id, appIds, 'products', 'app_id', r.id),
          notifie_id: fk(r.notifie_id, notifieIds, 'products', 'notifie_id', r.id),
          company_id: fk(r.company_id, companyIds, 'products', 'company_id', r.id),
          domain_id: fk(r.domain_id, domainIds, 'products', 'domain_id', r.id),
          device_type_id: fk(r.device_type_id, deviceTypeIds, 'products', 'device_type_id', r.id),
          vendor_id: fk(r.vendor_id, vendorIds, 'products', 'vendor_id', r.id),
          ...ts(r),
        });
        // plan_id: JSON array of plan ids → pivot
        let arr: unknown = null;
        try {
          arr = r.plan_id ? JSON.parse(String(r.plan_id)) : null;
          if (typeof arr === 'string') arr = JSON.parse(arr);
        } catch {
          arr = null;
        }
        if (Array.isArray(arr)) {
          for (const pid of arr) {
            const p = toId(pid);
            if (p && planIds.has(p)) planPivot.push({ product_id: toId(r.id), plan_id: p });
            else if (p) unresolved(KEY, 'product_plans', 'plan_id', pid, r.id, 'plan not found — pivot row skipped');
          }
        }
      }
      loaded += await loadObjects('products', productRows, {
        conflict: upsert('(id)', Object.keys(productRows[0] ?? { id: 1 }), ['id']),
      });
      await setval('products');
      // product_plans has no surrogate id — PK (product_id, plan_id)
      await pg.query('delete from product_plans where product_id = any($1)', [
        productRows.map((p) => p.id),
      ]);
      loaded += await loadObjects('product_plans', planPivot, { conflict: 'ignore' });
    }

    // ---- user_xup_preferences ------------------------------------
    {
      const src = await mysqlAll('select * from user_xup_preferences');
      source += src.length;
      const productIds = new Set((await pg.query<{ id: string }>('select id::text from products')).rows.map((r) => r.id));
      const attrIds = new Set((await pg.query<{ id: string }>('select id::text from attributes')).rows.map((r) => r.id));
      const rows: Record<string, unknown>[] = [];
      let dropped = 0;
      for (const r of src as Record<string, unknown>[]) {
        const u = uid(r.user_id);
        const pid = toId(r.product_id);
        if (!u) {
          unresolved(KEY, 'user_xup_preferences', 'user_id', r.user_id, r.id, 'user not resolved — row dropped');
          dropped++;
          continue;
        }
        if (!pid || !productIds.has(pid)) {
          unresolved(KEY, 'user_xup_preferences', 'product_id', r.product_id, r.id, 'product not resolved — row dropped');
          dropped++;
          continue;
        }
        rows.push({
          id: toId(r.id),
          user_id: u,
          product_id: pid,
          notifie_id: fk(r.notifie_id, notifieIds, 'user_xup_preferences', 'notifie_id', r.id),
          attribute_id: fk(r.attribute_id, attrIds, 'user_xup_preferences', 'attribute_id', r.id),
          xup_id: fk(r.xup_id, xupIds, 'user_xup_preferences', 'xup_id', r.id),
          is_visible: toBool(r.is_visible) ?? true,
          send_notification: toBool(r.send_notification) ?? true,
          ...ts(r),
        });
      }
      // the target has unique (user_id, product_id, notifie_id, attribute_id,
      // xup_id); merged-user remap + nulled fks can collapse distinct source
      // rows onto one key. Keep the lowest id, log the rest.
      const byKey = new Map<string, Record<string, unknown>>();
      for (const row of rows) {
        const k = [row.user_id, row.product_id, row.notifie_id, row.attribute_id, row.xup_id].join('|');
        const existing = byKey.get(k);
        if (!existing) byKey.set(k, row);
        else {
          dropped++;
          unresolved(KEY, 'user_xup_preferences', 'unique', k, row.id, 'composite-key duplicate after remap — kept lowest id');
          if (Number(row.id) < Number(existing.id)) byKey.set(k, row);
        }
      }
      const deduped = [...byKey.values()];
      loaded += await loadObjects('user_xup_preferences', deduped, {
        conflict: upsert('(id)', Object.keys(deduped[0] ?? { id: 1 }), ['id']),
      });
      await setval('user_xup_preferences');
      if (dropped) unresolved(KEY, 'user_xup_preferences', '*', null, null, `${dropped} rows dropped (unresolved user/product)`);
    }

    return { rowsLoaded: loaded, sourceRows: source };
  },
};
