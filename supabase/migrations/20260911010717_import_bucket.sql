-- ============================================================================
-- Slice 10: Import / bulk upload
--   Private `imports` Storage bucket for the per-run error-report CSVs that the
--   4 CSV importers (`ImportController`) generate. The old app wrote a `.log` to
--   the public disk and returned `Storage::url()`; the target writes a CSV to a
--   private bucket and hands back a signed URL (ADR-011/034).
--   Same pattern as the 8b `contracts` bucket.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('imports', 'imports', false)
on conflict (id) do nothing;

-- Any authenticated user who can run at least one importer may read the reports
-- (they are non-sensitive — row numbers + error strings). Writes go through the
-- service-role client only (it bypasses RLS), like the other system paths.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'imports_bucket_read'
  ) then
    create policy imports_bucket_read on storage.objects
      for select to authenticated
      using (
        bucket_id = 'imports'
        and (
          public.auth_is_super_admin()
          or public.auth_can('inventory', 'create')
          or public.auth_can('buildings', 'create')
          or public.auth_can('marina', 'create')
          or public.auth_can('systems', 'create')
        )
      );
  end if;
end $$;
