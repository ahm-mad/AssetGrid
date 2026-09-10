/**
 * Phase 6 — billing (spec §4 group 6).
 *
 *   activation_attempts        ← activation_attempts
 *   activation_attempt_devices ← activation_attempt_devices
 *   payments                   ← payments
 *   payment_details            ← payment_details
 *   stripe_events              ← stripe_events
 *
 * `subscription_entitlements` is loaded in phase 5 (dependency order — ADR-037).
 * Most of these are empty in the dev dump; full loaders for parity.
 */

import type { Phase, PhaseResult } from './types.ts';
import { mysqlAll } from '../lib/read.ts';
import { pgPool } from '../lib/sources.ts';
import { loadObjects, setval, upsert } from '../lib/load.ts';
import { loadIdMap, uid } from '../lib/idmap.ts';
import { unresolved } from '../lib/unresolved.ts';
import { toId, toTs, toTsN, nz, toInt, toMoney } from '../lib/coerce.ts';

const KEY = '60-billing';
const PAYMENT_PROVIDER = new Set(['stripe', 'cash']);
const BILLING_MODE = new Set(['direct', 'dealer_assisted', 'dealer_billed']);
const AA_STATUS = new Set(['pending', 'completed', 'expired', 'failed']);

function ts(r: Record<string, unknown>) {
  return { created_at: toTs(r.created_at), updated_at: toTs(r.updated_at, r.created_at) };
}

export const phase: Phase = {
  key: KEY,
  title: 'Billing — activation attempts, payments, stripe_events',
  targetTables: [
    'activation_attempt_devices', 'activation_attempts',
    'payment_details', 'payments', 'stripe_events',
  ],

  async run(): Promise<PhaseResult> {
    await loadIdMap();
    const pg = pgPool();
    let loaded = 0;
    let source = 0;

    const planIds = new Set(
      (await pg.query<{ id: string }>('select id::text from plans')).rows.map((r) => r.id),
    );

    // ---- activation_attempts ----------------------------------------
    {
      const src = await mysqlAll('select * from activation_attempts');
      source += src.length;
      const rows: Record<string, unknown>[] = [];
      for (const r of src as Record<string, unknown>[]) {
        const pid = toId(r.plan_id);
        if (!pid || !planIds.has(pid)) {
          unresolved(KEY, 'activation_attempts', 'plan_id', r.plan_id, r.id, 'plan not found — row dropped (plan_id NOT NULL)');
          continue;
        }
        let bm = nz(r.billing_mode)?.toLowerCase() ?? 'direct';
        if (!BILLING_MODE.has(bm)) { unresolved(KEY, 'activation_attempts', 'billing_mode', r.billing_mode, r.id, '→ direct'); bm = 'direct'; }
        let pp = nz(r.payment_provider)?.toLowerCase() ?? 'stripe';
        if (!PAYMENT_PROVIDER.has(pp)) { unresolved(KEY, 'activation_attempts', 'payment_provider', r.payment_provider, r.id, '→ stripe'); pp = 'stripe'; }
        let st = nz(r.status)?.toLowerCase() ?? 'pending';
        if (!AA_STATUS.has(st)) { unresolved(KEY, 'activation_attempts', 'status', r.status, r.id, '→ pending'); st = 'pending'; }
        rows.push({
          id: toId(r.id),
          session_id: nz(r.session_id),
          idempotency_key: nz(r.idempotency_key),
          email: nz(r.email) ?? '',
          user_id: uid(r.user_id),
          plan_id: pid,
          billing_mode: bm,
          owner_xnid: nz(r.owner_xnid),
          billing_xnid: nz(r.billing_xnid),
          dealer_xnid: nz(r.dealer_xnid),
          device_count: toInt(r.device_count) ?? 0,
          payment_provider: pp,
          provider_reference_id: nz(r.provider_reference_id),
          checkout_session_id: nz(r.checkout_session_id),
          provider_customer_id: nz(r.provider_customer_id),
          provider_subscription_id: nz(r.provider_subscription_id),
          status: st,
          completed_at: toTsN(r.completed_at),
          ...ts(r),
        });
      }
      loaded += await loadObjects('activation_attempts', rows, {
        conflict: upsert('(id)', rows.length ? Object.keys(rows[0]) : ['id'], ['id']),
      });
      await setval('activation_attempts');
    }
    const attemptIds = new Set(
      (await pg.query<{ id: string }>('select id::text from activation_attempts')).rows.map((r) => r.id),
    );

    // ---- activation_attempt_devices --------------------------------
    {
      const src = await mysqlAll('select * from activation_attempt_devices');
      source += src.length;
      const rows: Record<string, unknown>[] = [];
      for (const r of src as Record<string, unknown>[]) {
        const aid = toId(r.activation_attempt_id);
        if (!aid || !attemptIds.has(aid)) {
          unresolved(KEY, 'activation_attempt_devices', 'activation_attempt_id', r.activation_attempt_id, r.id, 'attempt not found — row dropped');
          continue;
        }
        rows.push({
          id: toId(r.id),
          activation_attempt_id: aid,
          xnid: nz(r.xnid) ?? '',
          provider_status: nz(r.provider_status),
          provider_reference: nz(r.provider_reference),
          validation_status: nz(r.validation_status) ?? 'valid',
          activation_status: nz(r.activation_status) ?? 'pending',
          ...ts(r),
        });
      }
      loaded += await loadObjects('activation_attempt_devices', rows, {
        conflict: upsert('(id)', rows.length ? Object.keys(rows[0]) : ['id'], ['id']),
      });
      await setval('activation_attempt_devices');
    }

    // ---- payments -------------------------------------------------
    {
      const src = await mysqlAll('select * from payments');
      source += src.length;
      const rows = (src as Record<string, unknown>[]).map((r) => {
        let pp = nz(r.payment_provider)?.toLowerCase() ?? 'stripe';
        if (!PAYMENT_PROVIDER.has(pp)) { unresolved(KEY, 'payments', 'payment_provider', r.payment_provider, r.id, '→ stripe'); pp = 'stripe'; }
        return {
          id: toId(r.id),
          xnid: nz(r.xnid),
          provider_invoice_id: nz(r.provider_invoice_id),
          provider_payment_id: nz(r.provider_payment_id),
          payment_provider: pp,
          payment_method: nz(r.payment_method),
          amount: toMoney(r.amount) ?? '0.00',
          ...ts(r),
        };
      });
      loaded += await loadObjects('payments', rows, {
        conflict: upsert('(id)', rows.length ? Object.keys(rows[0]) : ['id'], ['id']),
      });
      await setval('payments');
    }
    const paymentIds = new Set(
      (await pg.query<{ id: string }>('select id::text from payments')).rows.map((r) => r.id),
    );

    // ---- payment_details ---------------------------------------
    {
      const src = await mysqlAll('select * from payment_details');
      source += src.length;
      const rows: Record<string, unknown>[] = [];
      for (const r of src as Record<string, unknown>[]) {
        const pid = toId(r.payment_id);
        if (!pid || !paymentIds.has(pid)) {
          unresolved(KEY, 'payment_details', 'payment_id', r.payment_id, r.id, 'payment not found — row dropped');
          continue;
        }
        rows.push({
          id: toId(r.id),
          payment_id: pid,
          first_name: nz(r.first_name),
          last_name: nz(r.last_name),
          card_last4: nz(r.card_last4),
          card_brand: nz(r.card_brand),
          month: nz(r.month),
          year: nz(r.year),
          address_1: nz(r.address_1),
          address_2: nz(r.address_2),
          city: nz(r.city),
          zip_code: nz(r.zip_code),
          state: nz(r.state),
          country: nz(r.country),
          ...ts(r),
        });
      }
      loaded += await loadObjects('payment_details', rows, {
        conflict: upsert('(id)', rows.length ? Object.keys(rows[0]) : ['id'], ['id']),
      });
      await setval('payment_details');
    }

    // ---- stripe_events ---------------------------------------
    {
      const src = await mysqlAll('select * from stripe_events');
      source += src.length;
      const rows = (src as Record<string, unknown>[]).map((r) => ({
        id: toId(r.id),
        event_id: nz(r.event_id) ?? `legacy-${r.id}`,
        type: nz(r.type) ?? 'unknown',
        ...ts(r),
      }));
      loaded += await loadObjects('stripe_events', rows, {
        conflict: upsert('(id)', rows.length ? Object.keys(rows[0]) : ['id'], ['id']),
      });
      await setval('stripe_events');
    }

    return { rowsLoaded: loaded, sourceRows: source };
  },
};
