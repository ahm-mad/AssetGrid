-- ============================================================================
-- Slice 8b: Marina PMS — contract lifecycle
--   1. Add the `contracts` / `contract_amendments` columns the old
--      ContractController + models reference but that never existed in the DB
--      (tech-debt B53): structured terms, e-signature payload, PDF pointers,
--      the contract date range, the customer link, `applied_at`.
--   2. Re-model `contracts.status` as text + CHECK (consistent with
--      reservations / assignments / stays — the `contract_status` enum only had
--      5 of the ~10 statuses ContractController::contractTransitions() uses).
--      ADR-032.
--   3. Private `contracts` Storage bucket for the rendered PDFs.
-- The 8a schema migration (20260910131806) is left untouched — additive only.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1 + 2. contracts columns + status re-model
-- ----------------------------------------------------------------------------
alter table public.contracts
  alter column status drop default;
alter table public.contracts
  alter column status type text using status::text;
alter table public.contracts
  alter column status set default 'required';
alter table public.contracts
  add constraint contracts_status_check check (status in (
    'not_required','required','sent','signed','rejected','active',
    'expired','terminated','amendment_required','amended'
  ));

alter table public.contracts
  add column start_date      date,
  add column end_date        date,
  add column structured_terms jsonb,
  add column signature       jsonb,
  add column pdf_url         text,
  add column pdf_path        text,
  add column user_id         uuid references public.profiles(id) on delete set null;

create index contracts_user_idx on public.contracts (user_id);

-- contract_amendments: `status` is already text; add the apply timestamp.
alter table public.contract_amendments
  add column applied_at timestamptz;

-- The `contract_status` enum is now unused. Keep the type defined (dropping it
-- would churn generated types for no gain); ADR-032 records the switch to text.

-- ----------------------------------------------------------------------------
-- 3. private `contracts` Storage bucket
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('contracts', 'contracts', false)
on conflict (id) do nothing;

-- Authenticated marina readers may read objects; writes go through the
-- service-role client only (it bypasses RLS), same as the webhook/system paths.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'contracts_bucket_read'
  ) then
    create policy contracts_bucket_read on storage.objects
      for select to authenticated
      using (bucket_id = 'contracts' and public.auth_can('marina', 'read'));
  end if;
end $$;
