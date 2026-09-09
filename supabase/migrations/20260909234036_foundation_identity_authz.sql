-- ============================================================================
-- Foundation: identity + authorization
-- Source of truth: docs/target/schema-postgres.md, docs/target/auth-design.md
-- ADRs: 004, 015, 018, 019, 020, 021, 025, 026, 028
--
-- This migration establishes the pieces every domain slice builds on:
--   * shared helpers (updated_at trigger, gen_xnid)
--   * the enum types used across the schema
--   * the etl.* audit schema (used by the Phase N+1 data migration)
--   * profiles / profile_details (replaces the old custom `users` + `detail_users`)
--   * role_types / modules / role_permissions / user_permissions / user_scopes
--   * the auth_* SQL functions (mirror of Laravel User::canDo / scopedTo)
--   * RLS on all of the above
--   * the new-user trigger + the custom access token hook
-- Per-domain tables land in their own slice migrations (ADR-002).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Shared helpers
-- ----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'BEFORE UPDATE trigger: stamps updated_at = now(). Attach to every table with an updated_at column.';

-- xnid generation. Old app: xnid = "xnid:user:" + uuid (casing normalised to lower).
create or replace function public.gen_xnid(prefix text)
returns text
language sql
volatile
as $$
  select 'xnid:' || prefix || ':' || gen_random_uuid()::text;
$$;

comment on function public.gen_xnid(text) is
  'Business identifier generator. Format: xnid:<entity>:<uuid>. Old app used "xnid:user:"+uuid.';

-- ----------------------------------------------------------------------------
-- 1. Enum types (schema-postgres.md §2)
-- ----------------------------------------------------------------------------

create type public.user_device_status        as enum ('decline', 'captured');
create type public.device_assignment_status  as enum ('active', 'suspended', 'released', 'inactive'); -- 'inactive' added (B40)
create type public.contract_status           as enum ('required', 'sent', 'signed', 'expired', 'cancelled');
create type public.invoice_status            as enum ('unpaid', 'paid', 'void', 'partially_paid');
create type public.pos_txn_type              as enum ('charge', 'credit');
create type public.neo_alarm_status          as enum ('pending', 'success', 'failed', 'partial');
create type public.notification_channel      as enum ('email', 'sms');
create type public.scheduler_recurrence      as enum ('daily', 'weekly', 'bi-weekly');
create type public.rate_plan_type            as enum ('percent', 'fixed');
create type public.entitlement_source        as enum ('stripe', 'admin', 'system');
create type public.payment_provider          as enum ('stripe', 'cash');
create type public.billing_mode              as enum ('direct', 'dealer_assisted', 'dealer_billed');
create type public.activation_attempt_status as enum ('pending', 'completed', 'expired', 'failed');
create type public.charging_timer_kind       as enum ('standard', 'quick');

-- ----------------------------------------------------------------------------
-- 2. ETL audit schema (data-migration.md) — populated in Phase N+1
-- ----------------------------------------------------------------------------

create schema if not exists etl;

comment on schema etl is 'Data-migration bookkeeping. Not exposed via the API (not in the exposed schemas list).';

create table etl.user_id_map (
  legacy_id  bigint primary key,          -- old MySQL users.id
  id         uuid   not null unique,      -- new auth.users.id / profiles.id
  created_at timestamptz not null default now()
);

create table etl.user_merges (
  id             bigserial primary key,
  kept_legacy_id bigint not null,
  merged_legacy_id bigint not null,
  reason         text,
  created_at     timestamptz not null default now()
);

create table etl.unresolved (
  id         bigserial primary key,
  table_name text not null,
  column_name text not null,
  raw_value  text,
  reason     text,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 3. Reference: role_types + modules (schema-postgres.md §8)
--    Fixed ids for parity with the old system.
-- ----------------------------------------------------------------------------

create table public.role_types (
  id          smallint primary key,
  title       text not null unique,
  description text,
  created_by  uuid,                       -- FK added after profiles exists (below)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

insert into public.role_types (id, title, description) values
  (1, 'Super Admin', 'Bypasses all permission + scope checks.'),
  (2, 'Admin',       'Company-level admin.'),
  (3, 'Customer',    'End user. No role_permissions rows; access via the ,customer route flag only.'),
  (4, 'Manager',     'Like Admin.'),
  (5, 'Dealer',      'Owns devices via profile_details.container_codes.'),
  (6, 'Partner',     'Owns devices via profile_details.inventory_device_ids.');

create table public.modules (
  id          smallint primary key,
  code        text not null unique,
  name        text,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

insert into public.modules (id, code) values
  (1,  'catalog'),
  (2,  'inventory'),
  (3,  'systems'),
  (4,  'commerce'),
  (5,  'buildings'),
  (6,  'dashboard'),
  (7,  'marina'),
  (8,  'messaging'),
  (9,  'rulebuilder'),
  (10, 'roles_permissions'),
  (11, 'data_scopes');

-- ----------------------------------------------------------------------------
-- 4. Identity: profiles + profile_details
--    (replaces the old custom `users` + `detail_users`)
-- ----------------------------------------------------------------------------

create table public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  legacy_id          bigint unique,                 -- old users.id (ETL)
  xnid               text,
  first_name         text,
  last_name          text,
  role_type_id       smallint not null default 3 references public.role_types (id),
  company_id         bigint,                        -- FK added in the users/companies slice
  domain_id          bigint,                        -- FK added in the users/companies slice
  residence_customer boolean not null default false,
  fcm_token          text,                          -- stored; no push-send in v1 (B44)
  deleted_at         timestamptz,                   -- soft delete (parity)
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index profiles_role_type_id_idx on public.profiles (role_type_id);
create index profiles_company_id_idx   on public.profiles (company_id);
create index profiles_domain_id_idx    on public.profiles (domain_id);
create index profiles_xnid_idx         on public.profiles (xnid);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- now that profiles exists, wire role_types.created_by
alter table public.role_types
  add constraint role_types_created_by_fkey
  foreign key (created_by) references public.profiles (id) on delete set null;

create table public.profile_details (
  id                   bigint generated by default as identity primary key,
  user_id              uuid not null unique references public.profiles (id) on delete cascade,
  phone_number         text,                        -- was bigint in the old schema
  phone_type           text,
  notification_phone   jsonb,
  notification_email   jsonb,
  manager_phone        jsonb,
  manager_email        jsonb,
  address_1            text,
  address_2            text,
  country              text,
  state                text,
  city                 text,
  postal_code          text,
  container_codes      text[]  not null default '{}',   -- Dealer scope (was JSON-of-strings container_id)
  inventory_device_ids bigint[] not null default '{}',  -- Partner scope (was JSON-of-ints inventory_device_id)
  dealer_id            uuid references public.profiles (id) on delete set null,
  email_notification   boolean not null default true,
  phone_notification   boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create trigger profile_details_set_updated_at
  before update on public.profile_details
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 5. Authorization tables
-- ----------------------------------------------------------------------------

create table public.role_permissions (
  role_type_id smallint not null references public.role_types (id) on delete cascade,
  module_id    smallint not null references public.modules (id) on delete cascade,
  can_read     boolean not null default false,
  can_create   boolean not null default false,
  can_update   boolean not null default false,
  can_delete   boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (role_type_id, module_id)
);

create trigger role_permissions_set_updated_at
  before update on public.role_permissions
  for each row execute function public.set_updated_at();

-- Seed from the old `permissions` table (deduped — B15). Dev-DB coverage 2026-09-10:
--   Super Admin (1): all 11 modules
--   Admin (2) & Manager (4): modules 2,3,4,5,6,10
--   Dealer (5): 2,4,5,6
--   Partner (6): 2,4,6
--   Customer (3): none
insert into public.role_permissions (role_type_id, module_id, can_read, can_create, can_update, can_delete)
select r.id, m.id, true, true, true, true
from public.role_types r
join public.modules m on (
      r.id = 1
   or (r.id in (2, 4) and m.id in (2, 3, 4, 5, 6, 10))
   or (r.id = 5      and m.id in (2, 4, 5, 6))
   or (r.id = 6      and m.id in (2, 4, 6))
);

create table public.user_permissions (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  module_id  smallint not null references public.modules (id) on delete cascade,
  can_read   boolean not null default false,
  can_create boolean not null default false,
  can_update boolean not null default false,
  can_delete boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, module_id)
);

create trigger user_permissions_set_updated_at
  before update on public.user_permissions
  for each row execute function public.set_updated_at();

create table public.user_scopes (
  user_id      uuid not null references public.profiles (id) on delete cascade,
  entity_type  text not null check (entity_type in
                 ('building', 'marina', 'inventory', 'commerce', 'messaging', 'rule_builder')),
  asset_ids    bigint[] not null,               -- flattened from old [{value,label}] JSON
  asset_labels jsonb,                            -- kept for the management UI
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (user_id, entity_type)
);

create index user_scopes_entity_type_idx on public.user_scopes (entity_type);

create trigger user_scopes_set_updated_at
  before update on public.user_scopes
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 6. Impersonation audit log (fixes A1/A2 — auth-design.md §5)
-- ----------------------------------------------------------------------------

create table public.impersonation_log (
  id         bigint generated by default as identity primary key,
  actor_id   uuid not null references public.profiles (id) on delete cascade,
  target_id  uuid not null references public.profiles (id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at   timestamptz,
  ip         inet,
  user_agent text
);

create index impersonation_log_actor_idx  on public.impersonation_log (actor_id);
create index impersonation_log_target_idx on public.impersonation_log (target_id);

-- ----------------------------------------------------------------------------
-- 7. Auth functions (mirror Laravel User::canDo / isCustomer / scopedTo)
--    auth-design.md §2.1 / §3. security definer so RLS does not recurse.
-- ----------------------------------------------------------------------------

create or replace function public.auth_role_title(p_user uuid default auth.uid())
returns text
language sql
stable
security definer
set search_path = public
as $$
  select rt.title
  from public.profiles p
  join public.role_types rt on rt.id = p.role_type_id
  where p.id = p_user;
$$;

create or replace function public.auth_is_super_admin(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.auth_role_title(p_user) = 'Super Admin';
$$;

create or replace function public.auth_is_customer(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.auth_role_title(p_user) = 'Customer';
$$;

create or replace function public.auth_can(p_module text, p_action text, p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_user is null then false
    when public.auth_is_super_admin(p_user) then true
    else coalesce(
      -- user override wins
      (select case p_action
          when 'read'   then up.can_read   when 'create' then up.can_create
          when 'update' then up.can_update when 'delete' then up.can_delete end
       from public.user_permissions up
       join public.modules m on m.id = up.module_id
       where up.user_id = p_user and lower(m.code) = lower(p_module)),
      -- else role permission
      (select case p_action
          when 'read'   then rp.can_read   when 'create' then rp.can_create
          when 'update' then rp.can_update when 'delete' then rp.can_delete end
       from public.role_permissions rp
       join public.modules m on m.id = rp.module_id
       join public.profiles p on p.role_type_id = rp.role_type_id
       where p.id = p_user and lower(m.code) = lower(p_module)),
      false)
  end;
$$;

create or replace function public.auth_scope_allows(p_entity text, p_asset bigint, p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_user is not null
    and (
      public.auth_is_super_admin(p_user)
      or not exists (
        select 1 from public.user_scopes
        where user_id = p_user and entity_type = p_entity
      )
      or exists (
        select 1 from public.user_scopes
        where user_id = p_user and entity_type = p_entity
          and p_asset = any (asset_ids)
      )
    );
$$;

comment on function public.auth_scope_allows(text, bigint, uuid) is
  'Mirror of User::scopedTo semantics: no user_scopes row = unrestricted; a row with empty asset_ids = locked out.';

-- ----------------------------------------------------------------------------
-- 8. New-user trigger (self-signup path -> Customer). Admin-created users are
--    inserted explicitly by the Server Actions with the service-role client.
-- ----------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, xnid, first_name, last_name, role_type_id)
  values (
    new.id,
    public.gen_xnid('user'),
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    coalesce((new.raw_user_meta_data ->> 'role_type_id')::smallint, 3)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 9. Custom Access Token Hook (auth-design.md §2.4)
--    Stamps role_title + domain_id into the JWT so proxy.ts needs no DB read.
--    Enable in the dashboard: Authentication -> Hooks -> Customize Access Token.
-- ----------------------------------------------------------------------------

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims    jsonb := event -> 'claims';
  v_role    text;
  v_domain  bigint;
begin
  select rt.title, p.domain_id
    into v_role, v_domain
  from public.profiles p
  join public.role_types rt on rt.id = p.role_type_id
  where p.id = (event ->> 'user_id')::uuid;

  if v_role is not null then
    claims := jsonb_set(claims, '{app_metadata,role_title}', to_jsonb(v_role));
  end if;
  if v_domain is not null then
    claims := jsonb_set(claims, '{app_metadata,domain_id}', to_jsonb(v_domain));
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
grant select on public.profiles, public.role_types to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;

-- ----------------------------------------------------------------------------
-- 10. Row Level Security
-- ----------------------------------------------------------------------------

alter table public.profiles          enable row level security;
alter table public.profile_details   enable row level security;
alter table public.role_types        enable row level security;
alter table public.modules           enable row level security;
alter table public.role_permissions  enable row level security;
alter table public.user_permissions  enable row level security;
alter table public.user_scopes       enable row level security;
alter table public.impersonation_log enable row level security;

-- profiles: read own, or with commerce.read; write own (app limits columns) or commerce.update
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.auth_can('commerce', 'read'));
create policy profiles_update on public.profiles for update
  using (id = auth.uid() or public.auth_can('commerce', 'update'))
  with check (id = auth.uid() or public.auth_can('commerce', 'update'));
create policy profiles_insert on public.profiles for insert
  with check (public.auth_can('commerce', 'create'));
create policy profiles_delete on public.profiles for delete
  using (public.auth_can('commerce', 'delete'));

-- profile_details: same gate, keyed by user_id
create policy profile_details_select on public.profile_details for select
  using (user_id = auth.uid() or public.auth_can('commerce', 'read'));
create policy profile_details_write on public.profile_details for all
  using (user_id = auth.uid() or public.auth_can('commerce', 'update'))
  with check (user_id = auth.uid() or public.auth_can('commerce', 'update'));

-- role_types / modules: readable by any authenticated user (menu/UI); writes gated
create policy role_types_select on public.role_types for select to authenticated using (true);
create policy role_types_write  on public.role_types for all to authenticated
  using (public.auth_can('roles_permissions', 'update'))
  with check (public.auth_can('roles_permissions', 'create'));

create policy modules_select on public.modules for select to authenticated using (true);
create policy modules_write  on public.modules for all to authenticated
  using (public.auth_can('roles_permissions', 'update'))
  with check (public.auth_can('roles_permissions', 'create'));

-- role_permissions: readable by authenticated (drives the client permission matrix); writes gated
create policy role_permissions_select on public.role_permissions for select to authenticated using (true);
create policy role_permissions_write  on public.role_permissions for all to authenticated
  using (public.auth_can('roles_permissions', 'update'))
  with check (public.auth_can('roles_permissions', 'create'));

-- user_permissions: a user reads their own; managers read/write with roles_permissions
create policy user_permissions_select on public.user_permissions for select
  using (user_id = auth.uid() or public.auth_can('roles_permissions', 'read'));
create policy user_permissions_write on public.user_permissions for all
  using (public.auth_can('roles_permissions', 'update'))
  with check (public.auth_can('roles_permissions', 'create'));

-- user_scopes: a user reads their own; managers read/write with roles_permissions.
-- The creator-ceiling WITH CHECK is added in the users slice (needs auth_scope_allows over each asset).
create policy user_scopes_select on public.user_scopes for select
  using (user_id = auth.uid() or public.auth_can('roles_permissions', 'read'));
create policy user_scopes_write on public.user_scopes for all
  using (public.auth_can('roles_permissions', 'update'))
  with check (public.auth_can('roles_permissions', 'create'));

-- impersonation_log: only super admin / managers can read; inserts go through the service role
create policy impersonation_log_select on public.impersonation_log for select
  using (public.auth_is_super_admin() or actor_id = auth.uid());
