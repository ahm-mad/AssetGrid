/**
 * Phase 2 — auth users (spec §5, ADR-018/020/021).
 *
 * 1. Dedupe `users` by lower(email): keep the highest-signal row, remap the
 *    losers to the keeper in etl.user_id_map (is_merged), log to etl.user_merges.
 * 2. Insert each keeper into auth.users (bcrypt hash verbatim — $2y$, ADR-020)
 *    + auth.identities (provider 'email').
 * 3. etl.user_id_map ← keeper legacy_id → uuid, and every loser → keeper uuid.
 * 4. profiles ← one row per keeper (id from the map, legacy_id back-ref).
 * 5. profile_details ← from detail_users (keeper only; loser detail rows dropped).
 *
 * Idempotent: existing user_id_map uuids are reused; auth.users rows already
 * present (by lower(email)) are updated in place, not duplicated. auth.users is
 * never truncated (it holds the dev seed user).
 */

import { randomUUID } from 'node:crypto';
import type { Phase, PhaseResult } from './types.ts';
import { mysqlAll } from '../lib/read.ts';
import { pgPool } from '../lib/sources.ts';
import { loadObjects, loadRows, truncate } from '../lib/load.ts';
import { primeIdMap } from '../lib/idmap.ts';
import { unresolved } from '../lib/unresolved.ts';
import { info, warn } from '../lib/log.ts';
import { args } from '../config.ts';
import {
  nz,
  lower,
  toId,
  toBool,
  toTs,
  toTsN,
  toPhone,
  toIntArray,
  toStrArray,
  jsonParam,
} from '../lib/coerce.ts';

const KEY = '20-auth-users';

interface UserRow {
  id: string;
  xnid: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role_type_id: string | null;
  company_id: string | null;
  domain_id: string | null;
  email_verified_at: unknown;
  password: string;
  fcm_token: string | null;
  residence_customer: unknown;
  created_at: unknown;
  updated_at: unknown;
  deleted_at: unknown;
}

export const phase: Phase = {
  key: KEY,
  title: 'Auth users — auth.users, profiles, profile_details, user_id_map',
  targetTables: ['profiles', 'profile_details'], // auth.users handled manually

  async run(): Promise<PhaseResult> {
    const pg = pgPool();

    // ---- reference sets for FK validation ------------------------------------
    const roleIds = new Set(
      (await pg.query<{ id: number }>('select id from role_types')).rows.map((r) => String(r.id)),
    );
    const companyIds = new Set(
      (await pg.query<{ id: string }>('select id::text from companies')).rows.map((r) => r.id),
    );
    const domainIds = new Set(
      (await pg.query<{ id: string }>('select id::text from domains')).rows.map((r) => r.id),
    );

    // ---- extract ------------------------------------------------------------
    const users = await mysqlAll<UserRow>('select * from users');
    const details = await mysqlAll('select * from detail_users');
    const deviceCounts = new Map<string, number>();
    for (const r of await mysqlAll<{ user_id: string; c: number }>(
      'select user_id, count(*) c from user_devices group by user_id',
    )) {
      deviceCounts.set(String(r.user_id), Number(r.c));
    }
    const detailByUser = new Map<string, Record<string, unknown>>();
    for (const d of details) detailByUser.set(String((d as { user_id: unknown }).user_id), d);

    // ---- dedupe by lower(email) (spec §5.1) --------------------------------
    const groups = new Map<string, UserRow[]>();
    for (const u of users) {
      const key = (lower(u.email) ?? `__blank_${u.id}`).trim();
      (groups.get(key) ?? groups.set(key, []).get(key)!).push(u);
    }

    const signal = (u: UserRow): number[] => [
      detailByUser.has(String(u.id)) ? 1 : 0,
      deviceCounts.get(String(u.id)) ?? 0,
      toTsN(u.email_verified_at) ? 1 : 0,
      Date.parse(toTs(u.updated_at, u.created_at)),
      -Number(u.id), // lowest id wins ties (negate: higher score = better)
    ];
    const better = (a: UserRow, b: UserRow): UserRow => {
      const sa = signal(a);
      const sb = signal(b);
      for (let i = 0; i < sa.length; i++) if (sa[i] !== sb[i]) return sa[i] > sb[i] ? a : b;
      return a;
    };

    interface Keeper {
      user: UserRow;
      losers: UserRow[];
    }
    const keepers: Keeper[] = [];
    let collisionGroups = 0;
    for (const [, list] of groups) {
      if (list.length === 1) {
        keepers.push({ user: list[0], losers: [] });
        continue;
      }
      collisionGroups++;
      let keep = list[0];
      for (const u of list.slice(1)) keep = better(keep, u);
      keepers.push({ user: keep, losers: list.filter((u) => u !== keep) });
    }

    // ---- existing state (idempotency) -------------------------------------
    // Match by legacy_id stamped into raw_app_meta_data so a re-run after a
    // partial failure reuses the same uuid even if etl.user_id_map is stale.
    const authByLegacy = new Map<string, string>(); // legacy_id -> uuid
    const authEmails = new Set<string>(); // lower(email) of NON-ETL rows
    for (const r of (await pg.query<{ legacy: string | null; email: string; id: string }>(
      `select (raw_app_meta_data->>'legacy_id') legacy, lower(email) email, id::text id
         from auth.users where email is not null`,
    )).rows) {
      if (r.legacy) authByLegacy.set(r.legacy, r.id);
      else authEmails.add(r.email); // e.g. the dev seed user
    }
    for (const r of (await pg.query<{ legacy_id: string; id: string }>(
      'select legacy_id::text, id::text from etl.user_id_map where not is_merged',
    )).rows) {
      if (!authByLegacy.has(r.legacy_id)) authByLegacy.set(r.legacy_id, r.id);
    }

    // ---- resolve a uuid per keeper --------------------------------------
    const authRows: { id: string; keeper: Keeper; isNew: boolean }[] = [];
    for (const k of keepers) {
      const legacy = String(k.user.id);
      const emailKey = (lower(k.user.email) ?? '').trim();
      let id = authByLegacy.get(legacy);
      if (!id && emailKey && authEmails.has(emailKey)) {
        unresolved(KEY, 'auth.users', 'email', k.user.email, legacy,
          `email already owned by a non-ETL account; keeper legacy ${legacy} skipped`);
        continue;
      }
      const isNew = !id;
      authRows.push({ id: id ?? randomUUID(), keeper: k, isNew });
    }

    if (args.dryRun) {
      info(`   ${users.length} users → ${keepers.length} keepers (${collisionGroups} collision groups) → ${authRows.length} auth rows`);
      return {
        rowsLoaded: authRows.length,
        sourceRows: users.length,
        notes: `dry-run: ${collisionGroups} email collisions`,
      };
    }

    // ---- write auth.users + auth.identities (batched) -------------------
    const AUTH_COLS = [
      'instance_id', 'id', 'aud', 'role', 'email', 'encrypted_password',
      'email_confirmed_at', 'raw_app_meta_data', 'raw_user_meta_data',
      'created_at', 'updated_at',
      'confirmation_token', 'recovery_token', 'email_change_token_new',
      'email_change', 'email_change_token_current', 'reauthentication_token',
      'phone_change', 'phone_change_token',
      'is_sso_user', 'is_anonymous', 'email_change_confirm_status',
    ];
    const authTuples: unknown[][] = [];
    const identTuples: unknown[][] = [];
    const updates: { id: string; u: UserRow; confirmedAt: string | null; appMeta: string; userMeta: string }[] = [];
    let authInserted = 0;
    let authUpdated = 0;

    // Old accounts all functioned without an enforced verification gate, and
    // v1 cannot send confirmation email (ADR-036 mocks all mail). So by default
    // every migrated user is confirmed (backfill from created_at when
    // email_verified_at was null). `--strict-email-confirm` keeps the verbatim
    // §5.2 mapping instead. The backfilled rows are logged.
    const strictConfirm = process.argv.includes('--strict-email-confirm');
    for (const { id, keeper, isNew } of authRows) {
      const u = keeper.user;
      const verifiedAt = toTsN(u.email_verified_at);
      const confirmedAt = strictConfirm
        ? verifiedAt
        : verifiedAt ?? toTs(u.created_at);
      if (!strictConfirm && !verifiedAt) {
        unresolved(KEY, 'auth.users', 'email_confirmed_at', null, id,
          'email_verified_at was null → confirmed at created_at (use --strict-email-confirm to keep unconfirmed)');
      }
      const appMeta = JSON.stringify({ provider: 'email', providers: ['email'], legacy_id: Number(u.id) });
      const userMeta = JSON.stringify({ first_name: nz(u.first_name), last_name: nz(u.last_name) });
      if (isNew) {
        authTuples.push([
          '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated',
          u.email, u.password /* bcrypt $2y$ verbatim — ADR-020 */, confirmedAt, appMeta, userMeta,
          toTs(u.created_at), toTs(u.updated_at, u.created_at),
          '', '', '', '', '', '', '', '',
          false, false, 0,
        ]);
        identTuples.push([
          id, id,
          JSON.stringify({ sub: id, email: u.email, email_verified: verifiedAt != null, phone_verified: false }),
          'email', null, toTs(u.created_at), toTs(u.updated_at, u.created_at),
        ]);
        authInserted++;
      } else {
        updates.push({ id, u, confirmedAt, appMeta, userMeta });
        authUpdated++;
      }
    }

    await loadRows('auth.users', authTuples, {
      columns: AUTH_COLS,
      conflict: 'error',
      batchSize: 200,
    });
    await loadRows('auth.identities', identTuples, {
      columns: ['provider_id', 'user_id', 'identity_data', 'provider', 'last_sign_in_at', 'created_at', 'updated_at'],
      conflict: { onConflict: '(provider_id, provider)' },
      batchSize: 200,
    });
    for (let i = 0; i < updates.length; i += 300) {
      const slice = updates.slice(i, i + 300);
      const params: unknown[] = [];
      const tuples = slice
        .map(({ id, u, confirmedAt, appMeta, userMeta }) => {
          const b = params.length;
          params.push(id, u.email, u.password, confirmedAt, appMeta, userMeta, toTs(u.updated_at, u.created_at));
          return `($${b + 1}::uuid,$${b + 2},$${b + 3},$${b + 4}::timestamptz,$${b + 5}::jsonb,$${b + 6}::jsonb,$${b + 7}::timestamptz)`;
        })
        .join(',');
      await pg.query(
        `update auth.users u set
           email = v.email, encrypted_password = v.pw, email_confirmed_at = v.confirmed,
           raw_app_meta_data = v.appmeta, raw_user_meta_data = v.usermeta, updated_at = v.updated
         from (values ${tuples}) as v(id, email, pw, confirmed, appmeta, usermeta, updated)
         where u.id = v.id`,
        params,
      );
    }

    // ---- etl.user_id_map + etl.user_merges -------------------------------
    const mapRows: Record<string, unknown>[] = [];
    const mergeRows: Record<string, unknown>[] = [];
    for (const { id, keeper } of authRows) {
      mapRows.push({ legacy_id: toId(keeper.user.id), id, is_merged: false });
      for (const loser of keeper.losers) {
        mapRows.push({ legacy_id: toId(loser.id), id, is_merged: true });
        mergeRows.push({
          loser_legacy_id: toId(loser.id),
          keeper_legacy_id: toId(keeper.user.id),
          email: nz(loser.email),
          reason: 'lower(email) collision — kept highest-signal row',
        });
      }
    }
    await loadObjects('etl.user_id_map', mapRows, {
      conflict: { onConflict: '(legacy_id)', setColumns: ['id', 'is_merged'] },
    });
    // etl.user_merges is fully derived — rebuild it each run.
    // Shape: (id bigserial pk, kept_legacy_id, merged_legacy_id, reason,
    // created_at) + `email` added by 20260911120000_etl_bookkeeping.sql.
    await truncate(['etl.user_merges']);
    if (mergeRows.length) {
      await loadObjects(
        'etl.user_merges',
        mergeRows.map((m) => ({
          kept_legacy_id: m.keeper_legacy_id,
          merged_legacy_id: m.loser_legacy_id,
          email: m.email,
          reason: m.reason,
        })),
        { conflict: 'ignore' },
      );
    }

    // prime the in-memory map for later phases in this same run
    primeIdMap(mapRows.map((m) => [String(m.legacy_id), String(m.id)]));

    // ---- profiles --------------------------------------------------------
    const profileRows = authRows.map(({ id, keeper }) => {
      const u = keeper.user;
      let roleId = nz(u.role_type_id);
      if (!roleId || !roleIds.has(roleId)) {
        if (roleId) unresolved(KEY, 'profiles', 'role_type_id', roleId, id, 'unknown role_type_id → default 3 (Customer)');
        roleId = '3';
      }
      let companyId = toId(u.company_id);
      if (companyId && !companyIds.has(companyId)) {
        unresolved(KEY, 'profiles', 'company_id', companyId, id, 'unknown company_id → null');
        companyId = null;
      }
      let domainId = toId(u.domain_id);
      if (domainId && !domainIds.has(domainId)) {
        unresolved(KEY, 'profiles', 'domain_id', domainId, id, 'unknown domain_id → null');
        domainId = null;
      }
      return {
        id,
        legacy_id: toId(u.id),
        xnid: nz(u.xnid),
        first_name: nz(u.first_name),
        last_name: nz(u.last_name),
        role_type_id: Number(roleId),
        company_id: companyId,
        domain_id: domainId,
        residence_customer: toBool(u.residence_customer) ?? false,
        fcm_token: nz(u.fcm_token),
        deleted_at: toTsN(u.deleted_at),
        created_at: toTs(u.created_at),
        updated_at: toTs(u.updated_at, u.created_at),
      };
    });
    const profilesLoaded = await loadObjects('profiles', profileRows, {
      conflict: {
        onConflict: '(id)',
        setColumns: [
          'legacy_id', 'xnid', 'first_name', 'last_name', 'role_type_id',
          'company_id', 'domain_id', 'residence_customer', 'fcm_token',
          'deleted_at', 'updated_at',
        ],
      },
    });

    // ---- profile_details ------------------------------------------------
    const inventoryIds = new Set(
      (await pg.query<{ id: string }>('select id::text from inventory_devices')).rows.map((r) => r.id),
    );
    const uuidByLegacy = new Map(mapRows.map((m) => [String(m.legacy_id), String(m.id)]));
    const detailRows: Record<string, unknown>[] = [];
    for (const { keeper } of authRows) {
      const d = detailByUser.get(String(keeper.user.id));
      if (!d) continue;
      const userUuid = uuidByLegacy.get(String(keeper.user.id))!;

      const invArr = toIntArray((d as Record<string, unknown>).inventory_device_id);
      // Only filter if inventory_devices is already loaded (phase 50 runs after
      // this one on a full run); otherwise keep the raw ids — the column has no
      // FK and the Partner-scope reader tolerates gaps.
      let invFiltered = invArr ?? [];
      if (invArr && inventoryIds.size > 0) {
        invFiltered = invArr.filter((n) => inventoryIds.has(String(n)));
        if (invFiltered.length !== invArr.length) {
          unresolved(KEY, 'profile_details', 'inventory_device_ids',
            JSON.stringify(invArr), userUuid, 'dropped ids not in inventory_devices');
        }
      }

      let dealerUuid: string | null = null;
      const dealerRaw = nz((d as Record<string, unknown>).dealer_id);
      if (dealerRaw) {
        dealerUuid = uuidByLegacy.get(dealerRaw.trim()) ?? null;
        if (!dealerUuid) {
          // fall back to the persisted map (dealer may be in an earlier run)
          const hit = await pg.query<{ id: string }>(
            'select id::text from etl.user_id_map where legacy_id = $1', [dealerRaw.trim()],
          );
          dealerUuid = hit.rows[0]?.id ?? null;
        }
        if (!dealerUuid) unresolved(KEY, 'profile_details', 'dealer_id', dealerRaw, userUuid, 'unresolved dealer_id → null');
      }

      detailRows.push({
        id: toId((d as Record<string, unknown>).id),
        user_id: userUuid,
        phone_number: toPhone((d as Record<string, unknown>).phone_number),
        phone_type: nz((d as Record<string, unknown>).phone_type),
        notification_phone: jsonParam((d as Record<string, unknown>).notification_phone),
        notification_email: jsonParam((d as Record<string, unknown>).notification_email),
        manager_phone: jsonParam((d as Record<string, unknown>).manager_phone),
        manager_email: jsonParam((d as Record<string, unknown>).manager_email),
        address_1: nz((d as Record<string, unknown>).address_1),
        address_2: nz((d as Record<string, unknown>).address_2),
        country: nz((d as Record<string, unknown>).country),
        state: nz((d as Record<string, unknown>).state),
        city: nz((d as Record<string, unknown>).city),
        postal_code: nz((d as Record<string, unknown>).postal_code),
        container_codes: toStrArray((d as Record<string, unknown>).container_id) ?? [],
        inventory_device_ids: invFiltered,
        dealer_id: dealerUuid,
        email_notification: toBool((d as Record<string, unknown>).email_notification) ?? true,
        phone_notification: toBool((d as Record<string, unknown>).phone_notification) ?? true,
        created_at: toTs((d as Record<string, unknown>).created_at),
        updated_at: toTs((d as Record<string, unknown>).updated_at, (d as Record<string, unknown>).created_at),
      });
    }
    const detailsLoaded = await loadObjects('profile_details', detailRows, {
      conflict: {
        onConflict: '(user_id)',
        setColumns: [
          'phone_number', 'phone_type', 'notification_phone', 'notification_email',
          'manager_phone', 'manager_email', 'address_1', 'address_2', 'country',
          'state', 'city', 'postal_code', 'container_codes', 'inventory_device_ids',
          'dealer_id', 'email_notification', 'phone_notification', 'updated_at',
        ],
      },
    });

    warn(
      `${collisionGroups} email collision group(s); auth ${authInserted} inserted / ${authUpdated} updated`,
    );
    return {
      rowsLoaded: profilesLoaded + detailsLoaded,
      sourceRows: users.length,
      notes: `${keepers.length} keepers, ${authInserted}+${authUpdated} auth, ${detailsLoaded} details`,
    };
  },
};
