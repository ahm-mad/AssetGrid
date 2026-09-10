/**
 * Phase 1 — reference tables with no user FKs (spec §4 group 1).
 *
 *   role_types, modules, device_types, xups, notifies, vendors, packages,
 *   promo_codes, containers, domains, companies, apps
 *
 * Ids are preserved 1:1 (ADR-021). Several of these are already seeded by
 * 20260910010003_catalog_seed.sql — this phase UPSERTs from the source, which
 * is authoritative (spec §1.1), so it converges whether or not the seed ran
 * and picks up any prod rows the seed did not have. `created_by` (a source
 * varchar on role_types) cannot be resolved this early — profiles do not
 * exist until phase 20 — so it is left null and noted.
 */

import type { Phase, PhaseResult } from './types.ts';
import { mysqlAll } from '../lib/read.ts';
import { loadObjects, setval, upsert } from '../lib/load.ts';
import { toId, toTs, nz, jsonParam, toMoney } from '../lib/coerce.ts';
import { unresolved } from '../lib/unresolved.ts';
import { info } from '../lib/log.ts';

const KEY = '10-reference';

interface TableSpec {
  target: string;
  source: string;
  columns: string[];
  map(row: Record<string, unknown>): Record<string, unknown>;
}

function ts(row: Record<string, unknown>) {
  return {
    created_at: toTs(row.created_at),
    updated_at: toTs(row.updated_at, row.created_at),
  };
}

const SPECS: TableSpec[] = [
  {
    target: 'role_types',
    source: 'role_types',
    columns: ['id', 'title', 'description', 'created_by', 'created_at', 'updated_at'],
    map: (r) => {
      if (nz(r.created_by)) {
        unresolved(KEY, 'role_types', 'created_by', r.created_by, r.id, 'profiles not yet loaded; left null');
      }
      return {
        id: toId(r.id),
        title: nz(r.title),
        description: nz(r.description) ?? '',
        created_by: null,
        ...ts(r),
      };
    },
  },
  {
    target: 'modules',
    source: 'modules',
    columns: ['id', 'code', 'name', 'description', 'created_at', 'updated_at'],
    map: (r) => ({
      id: toId(r.id),
      code: nz(r.code),
      name: nz(r.name),
      description: nz(r.description),
      ...ts(r),
    }),
  },
  {
    target: 'device_types',
    source: 'device_types',
    columns: ['id', 'name', 'description', 'created_at', 'updated_at'],
    map: (r) => ({
      id: toId(r.id),
      name: nz(r.name),
      description: nz(r.description),
      ...ts(r),
    }),
  },
  {
    target: 'xups',
    source: 'xups',
    columns: ['id', 'code', 'data_type', 'version', 'description', 'format', 'units', 'label', 'created_at', 'updated_at'],
    map: (r) => ({
      id: toId(r.id),
      code: nz(r.xUP),
      data_type: nz(r.data_type) ?? 'unknown',
      version: nz(r.xUPv) ?? '1',
      description: nz(r.description),
      format: nz(r.format),
      units: nz(r.units),
      label: nz(r.lable),
      ...ts(r),
    }),
  },
  {
    target: 'notifies',
    source: 'notifies',
    columns: ['id', 'name', 'created_at', 'updated_at'],
    map: (r) => ({ id: toId(r.id), name: nz(r.name), ...ts(r) }),
  },
  {
    target: 'vendors',
    source: 'vendors',
    columns: ['id', 'name', 'address', 'description', 'created_at', 'updated_at'],
    map: (r) => ({
      id: toId(r.id),
      name: nz(r.name),
      address: nz(r.address),
      description: nz(r.description),
      ...ts(r),
    }),
  },
  {
    target: 'packages',
    source: 'packages',
    columns: ['id', 'name', 'price', 'duration', 'description', 'created_at', 'updated_at'],
    map: (r) => ({
      id: toId(r.id),
      name: nz(r.name),
      price: toMoney(r.price),
      duration: nz(r.duration),
      description: nz(r.description),
      ...ts(r),
    }),
  },
  {
    target: 'promo_codes',
    source: 'promo_codes',
    columns: ['id', 'promo_code', 'description', 'created_at', 'updated_at'],
    map: (r) => ({
      id: toId(r.id),
      promo_code: nz(r.promo_code),
      description: nz(r.description),
      ...ts(r),
    }),
  },
  {
    target: 'containers',
    source: 'containers',
    columns: ['id', 'code', 'created_at', 'updated_at'],
    map: (r) => ({ id: toId(r.id), code: nz(r.container_id), ...ts(r) }),
  },
  {
    target: 'domains',
    source: 'domains',
    columns: ['id', 'domain_url', 'created_at', 'updated_at'],
    map: (r) => ({ id: toId(r.id), domain_url: nz(r.domain_url), ...ts(r) }),
  },
  {
    target: 'companies',
    source: 'companies',
    columns: ['id', 'company_name', 'username', 'email', 'created_at', 'updated_at'],
    map: (r) => ({
      id: toId(r.id),
      company_name: nz(r.company_name),
      username: nz(r.username) ?? '',
      email: nz(r.email) ?? '',
      ...ts(r),
    }),
  },
  {
    target: 'apps',
    source: 'apps',
    columns: ['id', 'app_name', 'optional_parameters', 'xup_id', 'created_at', 'updated_at'],
    map: (r) => ({
      id: toId(r.id),
      app_name: nz(r.app_name),
      optional_parameters: jsonParam(r.optional_parameters),
      xup_id: toId(r.xup_id),
      ...ts(r),
    }),
  },
];

export const phase: Phase = {
  key: KEY,
  title: 'Reference tables (role_types … apps)',
  targetTables: SPECS.map((s) => s.target),

  async run(): Promise<PhaseResult> {
    let loaded = 0;
    let source = 0;
    for (const spec of SPECS) {
      const src = await mysqlAll(`select * from \`${spec.source}\``);
      source += src.length;
      const rows = src.map(spec.map);
      const n = await loadObjects(spec.target, rows, {
        conflict: upsert('(id)', spec.columns, ['id']),
      });
      // source is authoritative (§1.1) — drop rows the seed migration left
      // behind that no longer exist in the source. Guarded: an FK violation
      // means something depends on the stale row, so keep it and log.
      const srcIds = rows.map((r) => r.id).filter(Boolean);
      if (srcIds.length) {
        const { pgPool } = await import('../lib/sources.ts');
        try {
          const del = await pgPool().query(
            `delete from ${spec.target} where id <> all($1::bigint[])`,
            [srcIds],
          );
          if (del.rowCount) unresolved(KEY, spec.target, 'id', null, null, `${del.rowCount} stale seed row(s) not in source — deleted`);
        } catch {
          unresolved(KEY, spec.target, 'id', null, null, 'stale seed rows kept (referenced elsewhere)');
        }
      }
      await setval(spec.target);
      info(`   ${spec.target}: ${src.length} source → ${rows.length} upserted`);
      loaded += n;
    }
    return { rowsLoaded: loaded, sourceRows: source };
  },
};
