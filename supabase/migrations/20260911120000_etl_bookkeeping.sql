-- ============================================================================
-- Phase N+1 — ETL bookkeeping schema (`etl.*`) — additive completion
--   Spec: docs/target/data-migration.md §4 (row 0), §5, §9, §10, §11, §12.
--   ADR-021 (id preservation + the one uuid remap), ADR-029 (telemetry last).
--
--   The `etl` schema and the first three tables (`user_id_map`, `user_merges`,
--   `unresolved`) were created by 20260909234036_foundation_identity_authz.sql.
--   This migration extends them (per the STATUS "extend an applied slice" rule:
--   never edit the committed file) and adds `run_log`, `file_map`,
--   `telemetry_progress`, indexes, and the service-role grants.
--
--   `etl` is not exposed through PostgREST (only `public` is) and is written
--   exclusively by the service-role ETL scripts in scripts/etl/. Safe to
--   truncate — it holds only migration provenance, never application data.
-- ============================================================================

-- Service role runs the ETL; give it full access to the bookkeeping schema.
grant usage on schema etl to service_role;
grant all on all tables in schema etl to service_role;
grant all on all sequences in schema etl to service_role;
alter default privileges in schema etl grant all on tables to service_role;
alter default privileges in schema etl grant all on sequences to service_role;

-- ----------------------------------------------------------------------------
-- user_id_map — the ONE id remap in the whole migration (ADR-021).
--   old public.users.id (bigint)  ->  new auth.users.id / profiles.id (uuid)
--   Dedupe losers (§5.1) get a row pointing at the *keeper's* uuid, flagged
--   is_merged, so every later `user_id` / `*_by` bigint resolves via one join.
-- ----------------------------------------------------------------------------
alter table etl.user_id_map
  add column if not exists is_merged boolean not null default false;
-- the foundation migration made `id` UNIQUE, but email-dedupe losers (§5.1)
-- deliberately point at the *keeper's* uuid, so several legacy_ids share one id.
alter table etl.user_id_map drop constraint if exists user_id_map_id_key;
create index if not exists user_id_map_id_idx on etl.user_id_map (id);

-- ----------------------------------------------------------------------------
-- user_merges — audit of every email-collision resolution (§5.1, ADR-018).
--   Existing columns: id, kept_legacy_id, merged_legacy_id, reason, created_at.
-- ----------------------------------------------------------------------------
alter table etl.user_merges
  add column if not exists email text;

-- ----------------------------------------------------------------------------
-- unresolved — every loose varchar FK (B10) / bad value that could not be
-- resolved, instead of being silently discarded (§1.4, §6.2, §10.4).
--   Existing columns: id, table_name, column_name, raw_value, reason, created_at.
-- ----------------------------------------------------------------------------
alter table etl.unresolved
  add column if not exists phase text,
  add column if not exists target_row_id text;
create index if not exists unresolved_table_idx
  on etl.unresolved (table_name, column_name);

-- ----------------------------------------------------------------------------
-- run_log — one row per phase execution (§10).
-- ----------------------------------------------------------------------------
create table if not exists etl.run_log (
  id           bigint generated always as identity primary key,
  run_id       text        not null,       -- groups the phases of one `etl.ts` run
  phase        text        not null,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  status       text        not null default 'running'
                 check (status in ('running','ok','error','skipped')),
  rows_loaded  bigint,
  source_rows  bigint,
  notes        text,
  error        text
);
create index if not exists run_log_run_idx on etl.run_log (run_id, id);

-- ----------------------------------------------------------------------------
-- file_map — storage file relocations (§9). old disk path -> bucket/object.
-- ----------------------------------------------------------------------------
create table if not exists etl.file_map (
  old_path     text        primary key,
  bucket       text        not null,
  object_path  text        not null,
  bytes        bigint,
  created_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- telemetry_progress — per-partition checkpoint so a crashed telemetry load
-- resumes mid-stream (§8.5, §11).
-- ----------------------------------------------------------------------------
create table if not exists etl.telemetry_progress (
  partition_key  text        primary key,      -- e.g. '2026_06'
  source         text,                          -- last source streamed into this partition
  rows_loaded    bigint      not null default 0,
  last_cursor    text,                          -- last id / _id consumed from that source
  budget_stopped boolean     not null default false,
  finished_at    timestamptz,
  updated_at     timestamptz not null default now()
);

comment on schema etl is
  'ETL bookkeeping (Phase N+1). Not application data; not exposed via PostgREST. '
  'Populated only by scripts/etl/. See docs/target/data-migration.md.';
