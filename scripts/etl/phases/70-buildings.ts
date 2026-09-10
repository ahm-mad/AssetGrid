/**
 * Phase 7 — buildings hierarchy (spec §4 group 7).
 *
 *   buildings → floors → units → areas → sites   (FK chain, ON DELETE CASCADE)
 *
 * The target denormalises `building_id` onto `units` and `areas` (the
 * location-hierarchy pattern — one-hop scope RLS). The source only has the
 * immediate parent FK, so this phase walks floors→building / units→floor to
 * backfill it.
 */

import type { Phase, PhaseResult } from './types.ts';
import { mysqlAll } from '../lib/read.ts';
import { pgPool } from '../lib/sources.ts';
import { loadObjects, setval, upsert } from '../lib/load.ts';
import { loadIdMap, uid } from '../lib/idmap.ts';
import { unresolved } from '../lib/unresolved.ts';
import { toId, toTs, nz, toLat, toLon } from '../lib/coerce.ts';

const KEY = '70-buildings';

function ts(r: Record<string, unknown>) {
  return { created_at: toTs(r.created_at), updated_at: toTs(r.updated_at, r.created_at) };
}

export const phase: Phase = {
  key: KEY,
  title: 'Buildings — buildings, floors, units, areas, sites',
  targetTables: ['sites', 'areas', 'units', 'floors', 'buildings'],

  async run(): Promise<PhaseResult> {
    await loadIdMap();
    const pg = pgPool();
    let loaded = 0;
    let source = 0;

    const companyIds = new Set(
      (await pg.query<{ id: string }>('select id::text from companies')).rows.map((r) => r.id),
    );
    const inventoryIds = new Set(
      (await pg.query<{ id: string }>('select id::text from inventory_devices')).rows.map((r) => r.id),
    );

    // ---- buildings --------------------------------------------------
    {
      const src = await mysqlAll('select * from buildings');
      source += src.length;
      const rows = (src as Record<string, unknown>[]).map((r) => {
        let companyId = toId(r.company_id);
        if (companyId && !companyIds.has(companyId)) {
          unresolved(KEY, 'buildings', 'company_id', companyId, r.id, 'unknown company → null');
          companyId = null;
        }
        return {
          id: toId(r.id),
          company_id: companyId,
          location_code: nz(r.location_code) ?? '',
          county_code: nz(r.county_code) ?? '',
          building_id: nz(r.building_id) ?? '',
          city_code: nz(r.city_code) ?? '',
          building_code: nz(r.building_code) ?? `bldg-${r.id}`,
          on_net_type: nz(r.on_net_type) ?? '',
          structure_category: nz(r.structure_category) ?? '',
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
      loaded += await loadObjects('buildings', rows, {
        conflict: upsert('(id)', rows.length ? Object.keys(rows[0]) : ['id'], ['id']),
      });
      await setval('buildings');
    }
    const buildingIds = new Set(
      (await pg.query<{ id: string }>('select id::text from buildings')).rows.map((r) => r.id),
    );

    // ---- floors ----------------------------------------------------
    const floorToBuilding = new Map<string, string>();
    {
      const src = await mysqlAll('select * from floors');
      source += src.length;
      const rows: Record<string, unknown>[] = [];
      for (const r of src as Record<string, unknown>[]) {
        const b = toId(r.building_id);
        if (!b || !buildingIds.has(b)) {
          unresolved(KEY, 'floors', 'building_id', r.building_id, r.id, 'building not found — row dropped');
          continue;
        }
        floorToBuilding.set(String(toId(r.id)), b);
        rows.push({ id: toId(r.id), building_id: b, name: nz(r.name) ?? '(unnamed)', ...ts(r) });
      }
      loaded += await loadObjects('floors', rows, {
        conflict: upsert('(id)', ['id', 'building_id', 'name', 'created_at', 'updated_at'], ['id']),
      });
      await setval('floors');
    }

    // ---- units ---------------------------------------------------
    const unitToBuilding = new Map<string, string>();
    {
      const src = await mysqlAll('select * from units');
      source += src.length;
      const rows: Record<string, unknown>[] = [];
      for (const r of src as Record<string, unknown>[]) {
        const f = toId(r.floor_id);
        const b = f ? floorToBuilding.get(String(f)) : undefined;
        if (!f || !b) {
          unresolved(KEY, 'units', 'floor_id', r.floor_id, r.id, 'floor/building not found — row dropped');
          continue;
        }
        unitToBuilding.set(String(toId(r.id)), b);
        rows.push({ id: toId(r.id), floor_id: f, building_id: b, name: nz(r.name) ?? '(unnamed)', ...ts(r) });
      }
      loaded += await loadObjects('units', rows, {
        conflict: upsert('(id)', ['id', 'floor_id', 'building_id', 'name', 'created_at', 'updated_at'], ['id']),
      });
      await setval('units');
    }

    // ---- areas -------------------------------------------------
    const areaToBuilding = new Map<string, string>();
    {
      const src = await mysqlAll('select * from areas');
      source += src.length;
      const rows: Record<string, unknown>[] = [];
      for (const r of src as Record<string, unknown>[]) {
        const un = toId(r.unit_id);
        const b = un ? unitToBuilding.get(String(un)) : undefined;
        if (!un || !b) {
          unresolved(KEY, 'areas', 'unit_id', r.unit_id, r.id, 'unit/building not found — row dropped');
          continue;
        }
        areaToBuilding.set(String(toId(r.id)), b);
        rows.push({ id: toId(r.id), unit_id: un, building_id: b, name: nz(r.name) ?? '(unnamed)', ...ts(r) });
      }
      loaded += await loadObjects('areas', rows, {
        conflict: upsert('(id)', ['id', 'unit_id', 'building_id', 'name', 'created_at', 'updated_at'], ['id']),
      });
      await setval('areas');
    }

    // ---- sites -----------------------------------------------
    {
      // target has `unique (inventory_device_id)` — a device mounts at one site
      const seenInv = new Set<string>();
      const src = await mysqlAll('select * from sites order by id');
      source += src.length;
      const rows: Record<string, unknown>[] = [];
      for (const r of src as Record<string, unknown>[]) {
        const area = toId(r.area_id);
        // prefer the source building_id; fall back to area→building
        let b = toId(r.building_id);
        if ((!b || !buildingIds.has(b)) && area) b = areaToBuilding.get(String(area)) ?? null;
        if (!b || !buildingIds.has(b)) {
          unresolved(KEY, 'sites', 'building_id', r.building_id, r.id, 'building not found — row dropped');
          continue;
        }
        if (!area || !areaToBuilding.has(String(area))) {
          unresolved(KEY, 'sites', 'area_id', r.area_id, r.id, 'area not found — row dropped (area_id NOT NULL)');
          continue;
        }
        let invId = toId(r.inventory_device_id);
        if (invId && !inventoryIds.has(invId)) {
          unresolved(KEY, 'sites', 'inventory_device_id', invId, r.id, 'unknown inventory device → null');
          invId = null;
        }
        if (invId && seenInv.has(invId)) {
          unresolved(KEY, 'sites', 'inventory_device_id', invId, r.id, 'device already mounted at a lower site id → null (target unique)');
          invId = null;
        }
        if (invId) seenInv.add(invId);
        rows.push({
          id: toId(r.id),
          xnid: nz(r.xnid),
          building_id: b,
          area_id: area,
          user_id: uid(r.user_id),
          inventory_device_id: invId,
          street_address: nz(r.street_address),
          latitude: toLat(r.latitude),
          longitude: toLon(r.longitude),
          country: nz(r.country),
          state_province: nz(r.state_province),
          city: nz(r.city),
          postal_code: nz(r.postal_code),
          room_name: nz(r.room_name) ?? '(unnamed)',
          end_point: nz(r.end_point),
          interface: nz(r.interface),
          accessory: nz(r.accessory),
          point: nz(r.point) ?? '0',
          unit_label: nz(r.unit_label),
          clli_code: nz(r.clli_code),
          lata: nz(r.lata),
          npa: nz(r.npa),
          central_office_code: nz(r.central_office_code),
          nxx: nz(r.nxx),
          noaa: nz(r.noaa),
          market: nz(r.market),
          ...ts(r),
        });
      }
      loaded += await loadObjects('sites', rows, {
        conflict: upsert('(id)', rows.length ? Object.keys(rows[0]) : ['id'], ['id']),
      });
      await setval('sites');
    }

    return { rowsLoaded: loaded, sourceRows: source };
  },
};
