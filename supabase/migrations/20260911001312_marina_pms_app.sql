-- ============================================================================
-- Slice 8a (app layer): Marina PMS
--   1. Tighten the PMS write RLS policies to also enforce the `marina` data
--      scope (the 20260910131806 policies checked scope on SELECT but not on
--      write — a scoped marina admin could insert/patch rows for any marina).
--      ADR-017 (fix authorization gaps in-slice, do not reproduce).
--   2. `marina_create_reservation()` — the quote→reservation store
--      (`ReservationController@store`) as one atomic function so the
--      quote/reservation/assignment/stay rows can never land partially.
--      SECURITY INVOKER: the caller's `marina` RLS still applies.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. scope-aware write policies
-- ----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'rate_plans','reservations','quotes','contracts','contract_amendments',
    'assignments','stays','pos_transactions','invoices','ledgers','meters'
  ]
  loop
    execute format('drop policy if exists %1$I_write on public.%1$I', t);
    execute format($f$
      create policy %1$I_write on public.%1$I for all to authenticated
      using (
        public.auth_is_super_admin()
        or (public.auth_can('marina','update')
            and (marina_id is null or public.auth_scope_allows('marina', marina_id)))
      )
      with check (
        public.auth_is_super_admin()
        or (public.auth_can('marina','create')
            and (marina_id is null or public.auth_scope_allows('marina', marina_id)))
      );
    $f$, t);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 2. atomic quote -> reservation store
-- ----------------------------------------------------------------------------
create or replace function public.marina_create_reservation(
  p_marina_id     bigint,
  p_dock_id       bigint,
  p_boat_id       bigint,
  p_user_id       uuid,
  p_rate_plan_id  bigint,
  p_loa           int,
  p_start_date    date,
  p_end_date      date,
  p_days          int,
  p_rate          numeric,
  p_subtotal      numeric,
  p_tax           numeric,
  p_total         numeric,
  p_slip_id       bigint  default null,
  p_discount      numeric default 0,
  p_surcharge     numeric default 0
) returns bigint
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_quote_id       bigint;
  v_reservation_id bigint;
  v_assignment_id  bigint;
  v_conflict       boolean;
begin
  if coalesce(p_total, 0) <= 0 or coalesce(p_subtotal, 0) <= 0 then
    raise exception 'Invalid quote data detected.' using errcode = 'check_violation';
  end if;

  -- overlap conflict on the same boat or slip (active statuses)
  select exists (
    select 1 from public.reservations r
    where r.status in ('confirmed','pending','hold','contract_required')
      and (r.boat_id = p_boat_id or (p_slip_id is not null and r.slip_id = p_slip_id))
      and r.start_date < p_end_date
      and r.end_date   > p_start_date
  ) into v_conflict;
  if v_conflict then
    raise exception 'Boat or slip is not available for selected dates.' using errcode = 'exclusion_violation';
  end if;

  insert into public.quotes (
    xnid, marina_id, slip_id, rate_plan_id, loa, start_date, end_date,
    rate, total, discount, surcharge, hold_expires_at, status
  ) values (
    'xnid:quote:' || gen_random_uuid(), p_marina_id, p_slip_id, p_rate_plan_id, p_loa,
    p_start_date, p_end_date, p_rate, p_total, nullif(p_discount, 0), nullif(p_surcharge, 0),
    now() + interval '15 minutes', 'draft'
  ) returning id into v_quote_id;

  insert into public.reservations (
    xnid, marina_id, user_id, dock_id, boat_id, slip_id, quote_id, rate_plan_id,
    loa, start_date, end_date, days, rate, subtotal, tax, total, status, billed_by
  ) values (
    'xnid:event:reservation:' || gen_random_uuid(), p_marina_id, p_user_id, p_dock_id, p_boat_id,
    p_slip_id, v_quote_id, p_rate_plan_id, p_loa, p_start_date, p_end_date, p_days, p_rate,
    p_subtotal, p_tax, p_total, 'confirmed', 'customer'
  ) returning id into v_reservation_id;

  update public.quotes set reservation_id = v_reservation_id, status = 'accepted' where id = v_quote_id;

  insert into public.assignments (
    xnid, marina_id, reservation_id, boat_id, slip_id, start_date, end_date, status
  ) values (
    'xnid:assignment:' || gen_random_uuid(), p_marina_id, v_reservation_id, p_boat_id,
    p_slip_id, p_start_date, p_end_date, 'unassigned'
  ) returning id into v_assignment_id;

  insert into public.stays (
    xnid, marina_id, assignment_id, reservation_id, boat_id, slip_id,
    expected_arrival, expected_departure, status
  ) values (
    'xnid:stay:' || gen_random_uuid(), p_marina_id, v_assignment_id, v_reservation_id, p_boat_id,
    p_slip_id, p_start_date, p_end_date, 'pending'
  );

  return v_reservation_id;
end $$;

comment on function public.marina_create_reservation is
  'Atomic quote->reservation store (ReservationController@store). Caller prices + '
  'validates; RLS marina scope applies (security invoker).';
