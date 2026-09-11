-- ============================================================================
-- pg_cron + pg_net scheduling for the internal scheduled-runner endpoints
-- (integrations-plan.md §5, ADR-010, ADR-041).
--
--   charging-tick             every 30s   -> app/api/internal/charging-tick
--   device-health-run         every 1 min -> app/api/internal/device-health
--   marina-pms-maintenance    every 5 min -> app/api/internal/marina-pms-maintenance
--   telemetry-partition-maintenance  monthly -> pure SQL (create_telemetry_partition)
--   expire-stale-attempts     every 15 min -> pure SQL (ExpireStalePendingAttempts, B22)
--
-- The three HTTP-calling jobs need the app's public base URL, which isn't
-- known yet (not deployed to Vercel). `private.app_config` holds it so it's a
-- one-row UPDATE to point at the real deployment later — no migration needed.
-- `ClearOldLogs` (B22) is intentionally NOT scheduled here — the doc never
-- specified a retention policy for it; left as a deferred tech-debt item
-- rather than inventing a deletion policy.
-- ============================================================================

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- ----------------------------------------------------------------------------
-- Config: base URL + the shared secret the internal routes check
-- (lib/internal/auth.ts's `x-internal-secret` header). Not exposed via
-- PostgREST (no `grant` to anon/authenticated); only postgres/service-role
-- and the cron jobs (which run as the job owner) can read it.
-- ----------------------------------------------------------------------------
create schema if not exists private;

create table private.app_config (
  key         text primary key,
  value       text not null,
  updated_at  timestamptz not null default now()
);
comment on table private.app_config is
  'Small runtime config for pg_cron jobs (site_url, internal_function_secret). '
  'Update site_url with one UPDATE once deployed to Vercel — no migration needed.';

insert into private.app_config (key, value) values
  ('site_url', 'http://localhost:3000'),
  ('internal_function_secret', encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (key) do nothing;

-- ----------------------------------------------------------------------------
-- Helper: fire-and-forget POST to one of our own internal routes via pg_net
-- (async — pg_net queues the request and returns immediately; pg_cron doesn't
-- wait on it). SECURITY DEFINER so the cron job (which runs as whichever role
-- scheduled it) can read `private.app_config` without a grant.
-- ----------------------------------------------------------------------------
create or replace function private.invoke_internal(path text)
returns void
language plpgsql
security definer
set search_path = private, extensions, public
as $$
declare
  v_url    text;
  v_secret text;
begin
  select value into v_url    from private.app_config where key = 'site_url';
  select value into v_secret from private.app_config where key = 'internal_function_secret';
  if v_url is null then
    raise warning 'private.app_config.site_url is not set — skipping %', path;
    return;
  end if;
  perform net.http_post(
    url     := v_url || path,
    headers := jsonb_build_object('x-internal-secret', v_secret, 'Content-Type', 'application/json'),
    body    := '{}'::jsonb,
    timeout_milliseconds := 25000
  );
end;
$$;

revoke all on function private.invoke_internal(text) from public;

-- ----------------------------------------------------------------------------
-- Schedules
-- ----------------------------------------------------------------------------

-- charging / schedule / sunset-sunrise loop — every 30 seconds (pg_cron 1.6
-- supports a 6-field seconds-precision schedule).
select cron.schedule(
  'charging-tick',
  '*/30 * * * * *',
  $$select private.invoke_internal('/api/internal/charging-tick')$$
);

-- device-health-scheduler runner — every minute.
select cron.schedule(
  'device-health-run',
  '* * * * *',
  $$select private.invoke_internal('/api/internal/device-health')$$
);

-- marina PMS maintenance (ReleaseExpiredHolds + ExpireReservations) — every 5 min.
select cron.schedule(
  'marina-pms-maintenance',
  '*/5 * * * *',
  $$select private.invoke_internal('/api/internal/marina-pms-maintenance')$$
);

-- telemetry monthly partition maintenance — pure SQL, no HTTP hop needed.
-- Runs at 00:00 on the 1st of each month, creating the partition 2 months out
-- so there's always a runway (mirrors the seed window in
-- 20260910122705_telemetry_ingestion.sql).
select cron.schedule(
  'telemetry-partition-maintenance',
  '0 0 1 * *',
  $$select public.create_telemetry_partition((date_trunc('month', now()) + interval '2 months')::date)$$
);

-- ExpireStalePendingAttempts (B22) — pure SQL, no side effects needed.
-- A checkout abandoned for over an hour is stale; matches the 30-minute
-- reuse window in lib/billing/checkout.ts (an attempt survives being reused
-- for 30 min, so 1h as the expiry floor leaves margin).
select cron.schedule(
  'expire-stale-activation-attempts',
  '*/15 * * * *',
  $$update public.activation_attempts
       set status = 'expired'
     where status = 'pending'
       and created_at < now() - interval '1 hour'$$
);
