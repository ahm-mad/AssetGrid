/**
 * Phase 3 — authorization (spec §4 group 3, §6.3).
 *
 *   role_permissions  ← permissions, DEDUPED (bool_or over the duplicate
 *                       (role,module) rows — B15); the mystery `permission`
 *                       column is dropped.
 *   user_permissions  ← user_permissions, PK (user_id, module_id); user_id and
 *                       created_by bigint → uuid.
 *   user_scopes       ← user_scopes; `assets` JSON [{value,label}] →
 *                       asset_ids bigint[] + asset_labels jsonb.
 *
 * role_permissions is already seeded by catalog_seed; this UPSERTs the source
 * (authoritative). user_permissions / user_scopes are empty in the dev dump but
 * get full loaders for parity.
 */

import type { Phase, PhaseResult } from './types.ts';
import { mysqlAll } from '../lib/read.ts';
import { pgPool } from '../lib/sources.ts';
import { loadObjects } from '../lib/load.ts';
import { loadIdMap, uid } from '../lib/idmap.ts';
import { unresolved } from '../lib/unresolved.ts';
import { toBool, toTs, nz, toJsonParam, toId } from '../lib/coerce.ts';

const KEY = '30-authz';
const SCOPE_ENTITIES = new Set([
  'building', 'marina', 'inventory', 'commerce', 'messaging', 'rule_builder',
]);

export const phase: Phase = {
  key: KEY,
  title: 'Authz — role_permissions, user_permissions, user_scopes',
  targetTables: ['user_permissions', 'user_scopes'], // role_permissions upserted, not truncated

  async run(): Promise<PhaseResult> {
    await loadIdMap();
    const pg = pgPool();
    const roleIds = new Set(
      (await pg.query<{ id: number }>('select id from role_types')).rows.map((r) => String(r.id)),
    );
    const moduleIds = new Set(
      (await pg.query<{ id: number }>('select id from modules')).rows.map((r) => String(r.id)),
    );

    let loaded = 0;
    let source = 0;

    // ---- role_permissions (deduped) --------------------------------------
    const perms = await mysqlAll('select * from permissions');
    source += perms.length;
    const agg = new Map<string, Record<string, unknown>>();
    for (const p of perms as Record<string, unknown>[]) {
      const rt = toId(p.role_type_id);
      const mod = toId(p.module_id);
      if (!rt || !mod) continue;
      if (!roleIds.has(rt) || !moduleIds.has(mod)) {
        unresolved(KEY, 'role_permissions', 'role/module', `${rt}/${mod}`, null, 'unknown role or module id → skipped');
        continue;
      }
      const key = `${rt}:${mod}`;
      const prev = agg.get(key);
      const row = {
        role_type_id: Number(rt),
        module_id: Number(mod),
        can_read: (toBool(p.can_read) ?? false) || (prev?.can_read as boolean ?? false),
        can_create: (toBool(p.can_create) ?? false) || (prev?.can_create as boolean ?? false),
        can_update: (toBool(p.can_update) ?? false) || (prev?.can_update as boolean ?? false),
        can_delete: (toBool(p.can_delete) ?? false) || (prev?.can_delete as boolean ?? false),
        created_at: toTs(p.created_at),
        updated_at: toTs(p.updated_at, p.created_at),
      };
      agg.set(key, row);
    }
    loaded += await loadObjects('role_permissions', [...agg.values()], {
      conflict: {
        onConflict: '(role_type_id, module_id)',
        setColumns: ['can_read', 'can_create', 'can_update', 'can_delete', 'updated_at'],
      },
    });

    // ---- user_permissions ----------------------------------------------
    const ups = await mysqlAll('select * from user_permissions');
    source += ups.length;
    const upRows: Record<string, unknown>[] = [];
    for (const p of ups as Record<string, unknown>[]) {
      const u = uid(p.user_id);
      const mod = toId(p.module_id);
      if (!u) {
        unresolved(KEY, 'user_permissions', 'user_id', p.user_id, null, 'user not in id map → skipped');
        continue;
      }
      if (!mod || !moduleIds.has(mod)) {
        unresolved(KEY, 'user_permissions', 'module_id', p.module_id, u, 'unknown module → skipped');
        continue;
      }
      upRows.push({
        user_id: u,
        module_id: Number(mod),
        can_read: toBool(p.can_read) ?? false,
        can_create: toBool(p.can_create) ?? false,
        can_update: toBool(p.can_update) ?? false,
        can_delete: toBool(p.can_delete) ?? false,
        created_by: uid(p.created_by),
        created_at: toTs(p.created_at),
        updated_at: toTs(p.updated_at, p.created_at),
      });
    }
    loaded += await loadObjects('user_permissions', upRows, {
      conflict: {
        onConflict: '(user_id, module_id)',
        setColumns: ['can_read', 'can_create', 'can_update', 'can_delete', 'created_by', 'updated_at'],
      },
    });

    // ---- user_scopes --------------------------------------------------
    const scopes = await mysqlAll('select * from user_scopes');
    source += scopes.length;
    const scopeRows: Record<string, unknown>[] = [];
    for (const s of scopes as Record<string, unknown>[]) {
      const u = uid(s.user_id);
      if (!u) {
        unresolved(KEY, 'user_scopes', 'user_id', s.user_id, null, 'user not in id map → skipped');
        continue;
      }
      let entity = nz(s.entity_type);
      if (entity && !SCOPE_ENTITIES.has(entity)) {
        unresolved(KEY, 'user_scopes', 'entity_type', entity, u, 'entity_type not in the target CHECK set — kept as-is');
      }
      // assets: [{value,label}, ...]  (may be double-encoded)
      let assets: unknown = s.assets;
      try {
        if (typeof assets === 'string') assets = JSON.parse(assets);
        if (typeof assets === 'string') assets = JSON.parse(assets);
      } catch {
        assets = null;
      }
      const list = Array.isArray(assets) ? assets : [];
      const assetIds = list
        .map((a) => toId((a as Record<string, unknown>)?.value ?? a))
        .filter((x): x is string => x !== null)
        .map(Number);
      scopeRows.push({
        user_id: u,
        entity_type: entity ?? 'building',
        asset_ids: assetIds,
        asset_labels: toJsonParam(list),
        created_by: uid(s.created_by),
        created_at: toTs(s.created_at),
        updated_at: toTs(s.updated_at, s.created_at),
      });
    }
    loaded += await loadObjects('user_scopes', scopeRows, {
      conflict: {
        onConflict: '(user_id, entity_type)',
        setColumns: ['asset_ids', 'asset_labels', 'created_by', 'updated_at'],
      },
    });

    return { rowsLoaded: loaded, sourceRows: source };
  },
};
