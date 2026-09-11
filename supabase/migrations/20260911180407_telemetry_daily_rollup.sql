-- ============================================================================
-- telemetry_daily_rollup — breadth-over-depth telemetry history (user decision,
-- 2026-09-11, see decisions.md ADR-038).
--
-- This project shares one free-tier Supabase account (500 MB hard cap) with
-- another portfolio project, and self-limits to ~300 MB total. Measured
-- directly against the dev dump: a single day of full raw telemetry
-- (raw_packet + xUP EDR kept) costs ~153 MB; the entire ~20-month history at
-- one aggregated row per device per day costs ~133 MB (295.5 B/row measured,
-- ~450k device-days). So `telemetry` (raw, partitioned) keeps only a short
-- recent window (a few days — set by the ETL's --since flag, not partition
-- pruning), and this table carries the full history at daily granularity for
-- trend charts and the planned AI trend-analysis feature (both read this
-- table, never raw `telemetry`, for anything beyond the recent window).
--
-- Populated by scripts/etl/phases/97-telemetry-rollup.ts, which aggregates
-- MySQL device_values + device_values_dump (server-side GROUP BY) and Mongo
-- device_values (aggregation pipeline) — never streams the raw rows into
-- Node. Also refreshable later by a pg_cron job that rolls up each finished
-- day of live `telemetry` and prunes the raw row once it's rolled up
-- (Phase N+2).
-- ============================================================================

create table public.telemetry_daily_rollup (
  user_device_id      bigint      not null references public.user_devices(id) on delete cascade,
  day                 date        not null,
  dev_eui             text,                          -- denormalised, for display without a join

  packet_count        integer     not null default 0,

  voltage_avg         numeric,    voltage_min         numeric,    voltage_max         numeric,
  temperature_avg     numeric,    temperature_min     numeric,    temperature_max     numeric,
  humidity_avg        numeric,    humidity_min        numeric,    humidity_max        numeric,
  active_power_avg    numeric,    active_power_min    numeric,    active_power_max    numeric,
  energy_consumed_avg numeric,    energy_consumed_min numeric,    energy_consumed_max numeric,

  -- discrete/boolean channels: how many of that day's packets had the flag set
  external_input_count smallint  not null default 0,
  light_count          smallint  not null default 0,
  move_count           smallint  not null default 0,
  reed_state_count     smallint  not null default 0,

  had_alert           boolean     not null default false,   -- any alert_log/neo_alarm_logs row that day
  last_reading         jsonb,                         -- compact snapshot of the day's last packet

  raw_sources          text[]     not null default '{}',    -- which legacy store(s) fed this row
  computed_at          timestamptz not null default now(),

  primary key (user_device_id, day)
);

create index telemetry_daily_rollup_day_idx on public.telemetry_daily_rollup (day desc);
create index telemetry_daily_rollup_deveui_idx on public.telemetry_daily_rollup (dev_eui);

comment on table public.telemetry_daily_rollup is
  'One row per (device, day) — the long-history, low-detail telemetry tier. '
  'Breadth-over-depth by design (ADR-038): trend charts and the AI '
  'trend-analysis feature read this, never raw telemetry, beyond the '
  'short recent raw window.';

alter table public.telemetry_daily_rollup enable row level security;
alter table public.telemetry_daily_rollup force row level security;

-- same visibility shape as telemetry itself (20260910122705_telemetry_ingestion.sql)
create policy telemetry_daily_rollup_select on public.telemetry_daily_rollup for select to authenticated
  using (
    public.auth_is_super_admin()
    or public.auth_owns_user_device(user_device_id)
    or exists (
      select 1 from public.user_devices ud
       where ud.id = user_device_id
         and ud.inventory_device_id is not null
         and public.auth_can('inventory', 'read')
         and public.auth_scope_allows('inventory', ud.inventory_device_id)
    )
  );

-- Realtime is not needed here (a once-a-day rollup, not a live stream).
