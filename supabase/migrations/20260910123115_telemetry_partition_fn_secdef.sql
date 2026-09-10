-- Follow-up to 20260910122705: make create_telemetry_partition() SECURITY
-- DEFINER so it can CREATE TABLE when invoked by a low-privilege role (the
-- PostgREST service role, or a pg_cron job that isn't the table owner).

create or replace function public.create_telemetry_partition(p_month date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  start_ts date := date_trunc('month', p_month)::date;
  end_ts   date := (date_trunc('month', p_month) + interval '1 month')::date;
  part     text := 'telemetry_' || to_char(start_ts, 'YYYY_MM');
begin
  if not exists (select 1 from pg_class where relname = part) then
    execute format(
      'create table public.%I partition of public.telemetry for values from (%L) to (%L)',
      part, start_ts, end_ts
    );
  end if;
end;
$$;

revoke all on function public.create_telemetry_partition(date) from public, anon, authenticated;
