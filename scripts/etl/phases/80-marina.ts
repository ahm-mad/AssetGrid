/**
 * Phase 8 — marina (spec §4 group 8, §7 consolidations).
 *
 * Physical:  marinas → docks → slips ; boats (+ unassign_boats merged) ;
 *            boat_devices (from boats.inventory_device_id JSON)
 * PMS chain: rate_plans, quotes, reservations, contracts, contract_amendments,
 *            assignments, stays, pos_transactions (+ pos_sales merged),
 *            invoices, ledgers, meters
 *
 * The target denormalises `marina_id` onto slips and every PMS table; the
 * source only has it on some. This phase derives it (slip→dock→marina,
 * boat→marina, contract→slip, …) and logs where it cannot.
 *
 * The PMS tables are ALL empty in the dev dump — their loaders are built for
 * the cutover (prod may have half-built rows) and only exercised with 0 rows
 * here. `marinas.company_id` / `boats.user_id` are loose varchar FKs (B10).
 */

import type { Phase, PhaseResult } from './types.ts';
import { mysqlAll } from '../lib/read.ts';
import { pgPool } from '../lib/sources.ts';
import { loadObjects, setval, upsert } from '../lib/load.ts';
import { loadIdMap, uid } from '../lib/idmap.ts';
import { unresolved } from '../lib/unresolved.ts';
import {
  toId, toTs, toTsN, nz, toBool, toInt, toNum, toLat, toLon, toMoney, toDate, jsonParam,
} from '../lib/coerce.ts';

const KEY = '80-marina';
const UNASSIGN_BOAT_ID_OFFSET = 1_000_000;
const CONTRACT_STATUS = new Set(['required', 'sent', 'signed', 'expired', 'cancelled', 'active', 'terminated', 'amended', 'renewed', 'draft']);
const INVOICE_STATUS = new Set(['unpaid', 'paid', 'void', 'partially_paid']);
const POS_TYPE = new Set(['charge', 'credit']);
const RATE_PLAN_TYPE = new Set(['percent', 'fixed']);

function ts(r: Record<string, unknown>) {
  return { created_at: toTs(r.created_at), updated_at: toTs(r.updated_at, r.created_at) };
}

export const phase: Phase = {
  key: KEY,
  title: 'Marina — physical + full PMS chain',
  targetTables: [
    'meters', 'ledgers', 'invoices', 'pos_transactions', 'stays', 'assignments',
    'contract_amendments', 'contracts', 'reservations', 'quotes', 'rate_plans',
    'boat_devices', 'boats', 'slips', 'docks', 'marinas',
  ],

  async run(): Promise<PhaseResult> {
    await loadIdMap();
    const pg = pgPool();
    let loaded = 0;
    let source = 0;

    const setOf = async (sql: string): Promise<Set<string>> =>
      new Set((await pg.query<{ v: string }>(sql)).rows.map((r) => r.v));

    const companyIds = await setOf('select id::text v from companies');
    const companyByName = new Map<string, string>();
    for (const r of (await pg.query<{ id: string; company_name: string }>('select id::text, company_name from companies')).rows) {
      companyByName.set(r.company_name.trim().toLowerCase(), r.id);
    }
    const inventoryIds = await setOf('select id::text v from inventory_devices');

    const fk = (val: unknown, set: Set<string>, table: string, col: string, rowId: unknown, nullable = true): string | null => {
      const id = toId(val);
      if (!id) return null;
      if (!set.has(id)) {
        unresolved(KEY, table, col, val, rowId, nullable ? 'unknown fk → null' : 'unknown fk (NOT NULL) → row dropped');
        return null;
      }
      return id;
    };

    // ---- marinas -------------------------------------------------
    {
      const src = await mysqlAll('select * from marinas');
      source += src.length;
      const rows = (src as Record<string, unknown>[]).map((r) => {
        // company_id: loose varchar (B10) — int-cast, else name match, else null
        let companyId: string | null = null;
        const raw = nz(r.company_id);
        if (raw) {
          const asInt = toId(raw);
          if (asInt && companyIds.has(asInt)) companyId = asInt;
          else if (companyByName.has(raw.trim().toLowerCase())) companyId = companyByName.get(raw.trim().toLowerCase())!;
          else unresolved(KEY, 'marinas', 'company_id', raw, r.id, 'not an id or known company_name → null');
        }
        return {
          id: toId(r.id),
          marina_name: nz(r.marina_name),
          company_id: companyId,
          xnid: nz(r.xnid),
          marina_code: nz(r.marina_code) ?? `marina-${r.id}`,
          location_code: nz(r.location_code) ?? '',
          county_code: nz(r.county_code) ?? '',
          marina_id: nz(r.marina_id) ?? '',
          city_code: nz(r.city_code) ?? '',
          on_net_type: nz(r.on_net_type) ?? '',
          structure_category: nz(r.structure_category) ?? '',
          map_rotation: toNum(r.map_rotation),
          zoom_level: toNum(r.zoom_level),
          structures: jsonParam(r.structures),
          uploaded_svg: nz(r.uploaded_svg),
          occupancy_key: nz(r.occupancy_key),
          street_address: nz(r.street_address),
          latitude: toLat(r.latitude),
          longitude: toLon(r.longitude),
          country: nz(r.country),
          city: nz(r.city),
          postal_code: nz(r.postal_code),
          state_province: nz(r.state_province),
          noaa: nz(r.noaa),
          clli_code: nz(r.clli_code),
          lata: nz(r.lata),
          npa: nz(r.npa),
          nxx: nz(r.nxx),
          ...ts(r),
        };
      });
      loaded += await loadObjects('marinas', rows, {
        conflict: upsert('(id)', rows.length ? Object.keys(rows[0]) : ['id'], ['id']),
      });
      await setval('marinas');
    }
    const marinaIds = await setOf('select id::text v from marinas');

    // ---- docks -------------------------------------------------
    const dockToMarina = new Map<string, string>();
    {
      const src = await mysqlAll('select * from docks');
      source += src.length;
      const rows: Record<string, unknown>[] = [];
      for (const r of src as Record<string, unknown>[]) {
        const m = fk(r.marina_id, marinaIds, 'docks', 'marina_id', r.id, false);
        if (!m) continue;
        dockToMarina.set(String(toId(r.id)), m);
        rows.push({
          id: toId(r.id), marina_id: m, name: nz(r.name) ?? '(unnamed)',
          rotation: nz(r.rotation), latitude: toLat(r.latitude), longitude: toLon(r.longitude),
          occupancy_key: nz(r.occupancy_key), ...ts(r),
        });
      }
      loaded += await loadObjects('docks', rows, {
        conflict: upsert('(id)', rows.length ? Object.keys(rows[0]) : ['id'], ['id']),
      });
      await setval('docks');
    }

    // ---- slips -------------------------------------------------
    const slipToMarina = new Map<string, string>();
    {
      const src = await mysqlAll('select * from slips');
      source += src.length;
      const rows: Record<string, unknown>[] = [];
      for (const r of src as Record<string, unknown>[]) {
        const d = toId(r.dock_id);
        const m = d ? dockToMarina.get(String(d)) : undefined;
        if (!d || !m) {
          unresolved(KEY, 'slips', 'dock_id', r.dock_id, r.id, 'dock/marina not resolved — row dropped');
          continue;
        }
        slipToMarina.set(String(toId(r.id)), m);
        rows.push({
          id: toId(r.id), xnid: nz(r.xnid), dock_id: d, marina_id: m,
          name: nz(r.name) ?? '(unnamed)',
          slip_number: nz(r.slip_number), slip_code: nz(r.slip_code),
          slip_tier: nz(r.slip_tier), slip_type: nz(r.slip_type),
          occupancy_status: nz(r.occupancy_status), slip_status: nz(r.slip_status),
          rotation: nz(r.rotation), notes: nz(r.notes),
          min_loa: toInt(r.min_loa), max_loa: toInt(r.max_loa),
          latitude: toLat(r.latitude), longitude: toLon(r.longitude),
          depth: toInt(r.depth),
          rate_plan_id: null, // rate_plans loads after slips; wired below
          is_active: toBool(r.is_active) ?? true,
          ...ts(r),
        });
      }
      loaded += await loadObjects('slips', rows, {
        conflict: upsert('(id)', rows.length ? Object.keys(rows[0]) : ['id'], ['id']),
      });
      await setval('slips');
    }
    const slipIds = await setOf('select id::text v from slips');

    // ---- boats (+ unassign_boats merged) + boat_devices ------
    const boatToMarina = new Map<string, string>();
    {
      const boats = await mysqlAll('select * from boats');
      const unassigned = await mysqlAll('select * from unassign_boats');
      source += boats.length + unassigned.length;
      const rows: Record<string, unknown>[] = [];
      const pivot: Record<string, unknown>[] = [];
      const pushBoat = (r: Record<string, unknown>, id: string, isUnassigned: boolean) => {
        const m = fk(r.marina_id, marinaIds, 'boats', 'marina_id', r.id, false);
        if (!m) return;
        boatToMarina.set(id, m);
        const slipId = isUnassigned ? null : fk(r.slip_id, slipIds, 'boats', 'slip_id', r.id);
        rows.push({
          id, xnid: nz(r.xnid),
          storage_status: nz(r.storage_status) ?? 'wet',
          marina_id: m,
          dock_id: toId(r.dock_id) ? fk(r.dock_id, new Set([...dockToMarina.keys()]), 'boats', 'dock_id', r.id) : null,
          slip_id: slipId,
          user_id: uid(r.user_id),
          boat_name: nz(r.boat_name) ?? '(unnamed)',
          boat_model: nz(r.boat_model), boat_type: nz(r.boat_type),
          boat_length: nz(r.boat_length), boat_length_unit: nz(r.boat_length_unit),
          boat_loa: nz(r.boat_loa), boat_loa_unit: nz(r.boat_loa_unit),
          beam: toNum(r.beam), beam_unit: nz(r.beam_unit),
          draft: toNum(r.draft), draft_unit: nz(r.draft_unit),
          power_requirement: nz(r.power_requirement), customer_type: nz(r.customer_type),
          street_address: nz(r.street_address),
          latitude: toLat(r.latitude), longitude: toLon(r.longitude),
          country: nz(r.country), state_province: nz(r.state_province),
          city: nz(r.city), postal_code: nz(r.postal_code),
          rotation: nz(r.rotation),
          end_point: nz(r.end_point), interface: nz(r.interface), accessory: nz(r.accessory),
          clli_code: nz(r.clli_code), lata: nz(r.lata), npa: nz(r.npa),
          central_office_code: nz(r.central_office_code), nxx: nz(r.nxx),
          noaa: nz(r.noaa), market: nz(r.market),
          monitoring_area: nz(r.monitoring_area), monitoring_room: nz(r.monitoring_room),
          monitoring_name: nz(r.monitoring_name), monitoring_opt_in: nz(r.monitoring_opt_in),
          ...ts(r),
        });
        // inventory_device_id JSON array → boat_devices
        let arr: unknown = null;
        try {
          arr = r.inventory_device_id ? JSON.parse(String(r.inventory_device_id)) : null;
          if (typeof arr === 'string') arr = JSON.parse(arr);
        } catch { arr = null; }
        if (Array.isArray(arr)) {
          for (const did of arr) {
            const d = toId(did);
            if (d && inventoryIds.has(d)) pivot.push({ boat_id: id, inventory_device_id: d, created_at: toTs(r.created_at) });
            else if (d) unresolved(KEY, 'boat_devices', 'inventory_device_id', did, id, 'device not in inventory — skipped');
          }
        }
      };
      for (const r of boats as Record<string, unknown>[]) pushBoat(r, String(toId(r.id)), false);
      for (const r of unassigned as Record<string, unknown>[]) {
        pushBoat(r, String(UNASSIGN_BOAT_ID_OFFSET + Number(toId(r.id))), true);
      }
      if (unassigned.length) unresolved(KEY, 'boats', 'id', null, null, `unassign_boats ids offset by +${UNASSIGN_BOAT_ID_OFFSET} (merged id space)`);
      // is_assigned is a generated column — never inserted
      const boatCols = rows.length ? Object.keys(rows[0]) : ['id'];
      loaded += await loadObjects('boats', rows, { conflict: upsert('(id)', boatCols, ['id']) });
      await setval('boats');
      await pg.query('delete from boat_devices where boat_id = any($1)', [rows.map((b) => b.id)]);
      loaded += await loadObjects('boat_devices', pivot, { conflict: 'ignore' });
    }
    const boatIds = await setOf('select id::text v from boats');

    // ---- rate_plans + wire slips.rate_plan_id ---------------
    {
      const src = await mysqlAll('select * from rate_plans');
      source += src.length;
      const rows: Record<string, unknown>[] = [];
      for (const r of src as Record<string, unknown>[]) {
        const m = fk(r.marina_id, marinaIds, 'rate_plans', 'marina_id', r.id, false);
        if (!m) continue;
        let type = nz(r.type)?.toLowerCase() ?? null;
        if (type && !RATE_PLAN_TYPE.has(type)) { unresolved(KEY, 'rate_plans', 'type', r.type, r.id, '→ null'); type = null; }
        rows.push({
          id: toId(r.id), name: nz(r.name), calc_type: nz(r.calc_type),
          rate: toMoney(r.rate), start_date: toDate(r.start_date), end_date: toDate(r.end_date),
          type,
          condition: jsonParam(r.condition) ?? (nz(r.condition) ? JSON.stringify(nz(r.condition)) : null),
          loa_unit: nz(r.loa_unit), value: toNum(r.value), marina_id: m, ...ts(r),
        });
      }
      loaded += await loadObjects('rate_plans', rows, {
        conflict: upsert('(id)', rows.length ? Object.keys(rows[0]) : ['id'], ['id']),
      });
      await setval('rate_plans');
      const ratePlanIds = await setOf('select id::text v from rate_plans');
      // now backfill slips.rate_plan_id from the source
      const slipSrc = await mysqlAll('select id, rate_plan_id from slips');
      const pairs = (slipSrc as Record<string, unknown>[])
        .map((r) => [toId(r.id), fk(r.rate_plan_id, ratePlanIds, 'slips', 'rate_plan_id', r.id)] as const)
        .filter(([sid, rp]) => sid && rp && slipIds.has(sid));
      for (const [sid, rp] of pairs) {
        await pg.query('update slips set rate_plan_id = $2 where id = $1', [sid, rp]);
      }
    }

    // ---- helper: derive marina_id for a PMS row via its links ----
    const marinaVia = (opts: { slip_id?: unknown; boat_id?: unknown; explicit?: unknown }): string | null => {
      const ex = toId(opts.explicit);
      if (ex && marinaIds.has(ex)) return ex;
      const s = toId(opts.slip_id);
      if (s && slipToMarina.has(s)) return slipToMarina.get(s)!;
      const b = toId(opts.boat_id);
      if (b && boatToMarina.has(b)) return boatToMarina.get(b)!;
      return null;
    };

    // ---- quotes ----------------------------------------------
    {
      const src = await mysqlAll('select * from quotes');
      source += src.length;
      const rows = (src as Record<string, unknown>[]).map((r) => ({
        id: toId(r.id), xnid: nz(r.xnid),
        marina_id: marinaVia({ slip_id: r.slip_id }),
        slip_id: fk(r.slip_id, slipIds, 'quotes', 'slip_id', r.id),
        rate_plan_id: toId(r.rate_plan_id),
        reservation_id: toId(r.reservation_id),
        loa: toInt(r.loa), loa_unit: nz(r.loa_unit),
        start_date: toDate(r.start_date), end_date: toDate(r.end_date),
        rate: toMoney(r.rate), total: toMoney(r.total),
        discount: toMoney(r.discount), discount_type: nz(r.discount_type),
        surcharge: toMoney(r.surcharge),
        hold_expires_at: toTsN(r.hold_expires_at),
        status: nz(r.status) ?? 'draft', ...ts(r),
      }));
      loaded += await loadObjects('quotes', rows, { conflict: upsert('(id)', rows.length ? Object.keys(rows[0]) : ['id'], ['id']) });
      await setval('quotes');
    }

    // ---- reservations --------------------------------------
    {
      const src = await mysqlAll('select * from reservations');
      source += src.length;
      const rows = (src as Record<string, unknown>[]).map((r) => ({
        id: toId(r.id), xnid: nz(r.xnid),
        marina_id: marinaVia({ explicit: r.marina_id, slip_id: r.slip_id, boat_id: r.boat_id }),
        user_id: uid(r.user_id),
        dock_id: toId(r.dock_id), boat_id: toId(r.boat_id), slip_id: toId(r.slip_id),
        quote_id: toId(r.quote_id), rate_plan_id: toId(r.rate_plan_id),
        loa: toInt(r.loa), start_date: toDate(r.start_date), end_date: toDate(r.end_date),
        days: toInt(r.days),
        rate: toMoney(r.rate), subtotal: toMoney(r.subtotal) ?? '0', tax: toMoney(r.tax) ?? '0', total: toMoney(r.total) ?? '0',
        status: nz(r.status) ?? 'draft', billed_by: nz(r.billed_by), ...ts(r),
      }));
      loaded += await loadObjects('reservations', rows, { conflict: upsert('(id)', rows.length ? Object.keys(rows[0]) : ['id'], ['id']) });
      await setval('reservations');
    }

    // ---- contracts ---------------------------------------
    {
      const src = await mysqlAll('select * from contracts');
      source += src.length;
      const rows: Record<string, unknown>[] = [];
      for (const r of src as Record<string, unknown>[]) {
        const slip = fk(r.slip_id, slipIds, 'contracts', 'slip_id', r.id, false);
        const boat = fk(r.boat_id, boatIds, 'contracts', 'boat_id', r.id, false);
        if (!slip || !boat) continue;
        let st = nz(r.status)?.toLowerCase() ?? 'required';
        if (!CONTRACT_STATUS.has(st)) { unresolved(KEY, 'contracts', 'status', r.status, r.id, '→ required'); st = 'required'; }
        rows.push({
          id: toId(r.id), xnid: nz(r.xnid),
          marina_id: marinaVia({ slip_id: r.slip_id, boat_id: r.boat_id }),
          slip_id: slip, boat_id: boat, rate_plan_id: toId(r.rate_plan_id),
          reservation_id: toId(r.reservation_id),
          contract_type: nz(r.contract_type),
          monthly_rate: toMoney(r.monthly_rate) ?? '0',
          status: st, signed_at: toTsN(r.signed_at),
          original_contract_id: toId(r.original_contract_id),
          start_date: null, end_date: null,
          structured_terms: null, signature: null, pdf_url: null, pdf_path: null, user_id: null,
          ...ts(r),
        });
      }
      loaded += await loadObjects('contracts', rows, { conflict: upsert('(id)', rows.length ? Object.keys(rows[0]) : ['id'], ['id']) });
      await setval('contracts');
    }
    const contractIds = await setOf('select id::text v from contracts');

    // ---- contract_amendments -------------------------
    {
      const src = await mysqlAll('select * from contract_amendments');
      source += src.length;
      const rows: Record<string, unknown>[] = [];
      for (const r of src as Record<string, unknown>[]) {
        const cid = fk(r.contract_id, contractIds, 'contract_amendments', 'contract_id', r.id, false);
        if (!cid) continue;
        rows.push({
          id: toId(r.id), xnid: nz(r.xnid), marina_id: null,
          contract_id: cid,
          amendment_type: nz(r.amendment_type) ?? 'terms_change',
          description: nz(r.description),
          changed_fields: jsonParam(r.changed_fields),
          original_amount: toMoney(r.original_amount), new_amount: toMoney(r.new_amount),
          original_start_date: toDate(r.original_start_date), original_end_date: toDate(r.original_end_date),
          new_start_date: toDate(r.new_start_date), new_end_date: toDate(r.new_end_date),
          original_slip_id: toId(r.original_slip_id), new_slip_id: toId(r.new_slip_id),
          status: nz(r.status) ?? 'draft', signed_at: toTsN(r.signed_at),
          applied_at: null, ...ts(r),
        });
      }
      loaded += await loadObjects('contract_amendments', rows, { conflict: upsert('(id)', rows.length ? Object.keys(rows[0]) : ['id'], ['id']) });
      await setval('contract_amendments');
    }

    // ---- assignments -------------------------------
    {
      const src = await mysqlAll('select * from assignments');
      source += src.length;
      const rows: Record<string, unknown>[] = [];
      for (const r of src as Record<string, unknown>[]) {
        const boat = fk(r.boat_id, boatIds, 'assignments', 'boat_id', r.id, false);
        const resv = toId(r.reservation_id);
        if (!boat || !resv) { unresolved(KEY, 'assignments', 'boat/reservation', `${r.boat_id}/${r.reservation_id}`, r.id, 'NOT NULL fk missing — row dropped'); continue; }
        rows.push({
          id: toId(r.id), xnid: nz(r.xnid),
          marina_id: marinaVia({ slip_id: r.slip_id, boat_id: r.boat_id }),
          reservation_id: resv, boat_id: boat, slip_id: toId(r.slip_id),
          start_date: toDate(r.start_date) ?? toDate(r.created_at),
          end_date: toDate(r.end_date),
          status: nz(r.status) ?? 'unassigned', ...ts(r),
        });
      }
      loaded += await loadObjects('assignments', rows, { conflict: upsert('(id)', rows.length ? Object.keys(rows[0]) : ['id'], ['id']) });
      await setval('assignments');
    }

    // ---- stays -----------------------------------
    {
      const src = await mysqlAll('select * from stays');
      source += src.length;
      const rows: Record<string, unknown>[] = [];
      for (const r of src as Record<string, unknown>[]) {
        const boat = fk(r.boat_id, boatIds, 'stays', 'boat_id', r.id, false);
        if (!boat || !toId(r.assignment_id) || !toId(r.reservation_id)) {
          unresolved(KEY, 'stays', 'fk', r.id, r.id, 'NOT NULL fk missing — row dropped'); continue;
        }
        rows.push({
          id: toId(r.id), xnid: nz(r.xnid),
          marina_id: marinaVia({ slip_id: r.slip_id, boat_id: r.boat_id }),
          assignment_id: toId(r.assignment_id), reservation_id: toId(r.reservation_id),
          boat_id: boat, slip_id: toId(r.slip_id),
          expected_arrival: toDate(r.expected_arrival), actual_arrival: toDate(r.actual_arrival),
          expected_departure: toDate(r.expected_departure), actual_departure: toDate(r.actual_departure),
          status: nz(r.status) && nz(r.status) !== 'null' ? nz(r.status) : 'expected',
          ...ts(r),
        });
      }
      loaded += await loadObjects('stays', rows, { conflict: upsert('(id)', rows.length ? Object.keys(rows[0]) : ['id'], ['id']) });
      await setval('stays');
    }

    // ---- pos_transactions (+ pos_sales merged) -------
    {
      const txns = await mysqlAll('select * from pos_transactions');
      const sales = await mysqlAll('select * from pos_sales');
      source += txns.length + sales.length;
      const rows: Record<string, unknown>[] = [];
      for (const r of txns as Record<string, unknown>[]) {
        let type = nz(r.type)?.toLowerCase() ?? 'charge';
        if (!POS_TYPE.has(type)) type = 'charge';
        rows.push({
          id: toId(r.id), xnid: nz(r.xnid),
          marina_id: marinaVia({ slip_id: r.slip_id, boat_id: r.boat_id }),
          stay_id: toId(r.stay_id), reservation_id: toId(r.reservation_id),
          assignment_id: toId(r.assignment_id), contract_id: null,
          boat_id: toId(r.boat_id), slip_id: toId(r.slip_id),
          service_category: nz(r.service_category), service_name: nz(r.service_name) ?? '(item)',
          amount: toMoney(r.amount) ?? '0', type,
          quantity: toInt(r.quantity) ?? 1, unit_price: toMoney(r.unit_price),
          notes: nz(r.notes), created_by: uid(r.created_by), ...ts(r),
        });
      }
      for (const r of sales as Record<string, unknown>[]) {
        let type = nz(r.type)?.toLowerCase() ?? 'charge';
        if (!POS_TYPE.has(type)) type = 'charge';
        rows.push({
          id: String(UNASSIGN_BOAT_ID_OFFSET + Number(toId(r.id))), // disjoint id space
          xnid: nz(r.xnid), marina_id: null,
          stay_id: toId(r.stay_id), reservation_id: toId(r.reservation_id),
          assignment_id: null, contract_id: toId(r.contract_id),
          boat_id: null, slip_id: null,
          service_category: null, service_name: nz(r.item) ?? '(item)',
          amount: toMoney(r.total) ?? '0', type,
          quantity: toInt(r.qty) ?? 1, unit_price: toMoney(r.unit_price),
          notes: null, created_by: null, ...ts(r),
        });
      }
      if (sales.length) unresolved(KEY, 'pos_transactions', 'id', null, null, `pos_sales ids offset by +${UNASSIGN_BOAT_ID_OFFSET} (merged id space)`);
      loaded += await loadObjects('pos_transactions', rows, { conflict: upsert('(id)', rows.length ? Object.keys(rows[0]) : ['id'], ['id']) });
      await setval('pos_transactions');
    }

    // ---- invoices --------------------------------
    {
      const src = await mysqlAll('select * from invoices');
      source += src.length;
      const rows = (src as Record<string, unknown>[]).map((r) => {
        let st = nz(r.status)?.toLowerCase() ?? 'unpaid';
        if (!INVOICE_STATUS.has(st)) st = 'unpaid';
        return {
          id: toId(r.id), xnid: nz(r.xnid), marina_id: null,
          billable_type: nz(r.billable_type) ?? 'unknown', billable_id: toId(r.billable_id) ?? '0',
          contract_id: toId(r.contract_id), reservation_id: toId(r.reservation_id), stay_id: toId(r.stay_id),
          amount: toMoney(r.amount) ?? '0', status: st, paid_at: toTsN(r.paid_at), ...ts(r),
        };
      });
      loaded += await loadObjects('invoices', rows, { conflict: upsert('(id)', rows.length ? Object.keys(rows[0]) : ['id'], ['id']) });
      await setval('invoices');
    }

    // ---- ledgers --------------------------------
    {
      const src = await mysqlAll('select * from ledgers');
      source += src.length;
      const rows = (src as Record<string, unknown>[]).map((r) => ({
        id: toId(r.id), xnid: nz(r.xnid), marina_id: null,
        invoice_id: toId(r.invoice_id),
        debit: toMoney(r.debit) ?? '0', credit: toMoney(r.credit) ?? '0',
        memo: nz(r.memo), ...ts(r),
      }));
      loaded += await loadObjects('ledgers', rows, { conflict: upsert('(id)', rows.length ? Object.keys(rows[0]) : ['id'], ['id']) });
      await setval('ledgers');
    }

    // ---- meters ---------------------------------
    {
      const src = await mysqlAll('select * from meters');
      source += src.length;
      const rows: Record<string, unknown>[] = [];
      for (const r of src as Record<string, unknown>[]) {
        const slip = fk(r.slip_id, slipIds, 'meters', 'slip_id', r.id, false);
        if (!slip) continue;
        rows.push({
          id: toId(r.id), xnid: nz(r.xnid),
          marina_id: slipToMarina.get(String(slip)) ?? null,
          slip_id: slip, reading: toMoney(r.reading) ?? '0', ...ts(r),
        });
      }
      loaded += await loadObjects('meters', rows, { conflict: upsert('(id)', rows.length ? Object.keys(rows[0]) : ['id'], ['id']) });
      await setval('meters');
    }

    return { rowsLoaded: loaded, sourceRows: source };
  },
};
