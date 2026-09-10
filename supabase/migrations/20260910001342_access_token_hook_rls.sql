-- ============================================================================
-- Let the Custom Access Token Hook read what it needs.
--
-- `public.custom_access_token_hook` is invoked by GoTrue as the
-- `supabase_auth_admin` role. It has SELECT grants on profiles + role_types
-- (from the foundation migration) but RLS is default-deny, so it also needs
-- explicit policies. Without this the hook silently sees zero rows and never
-- stamps `role_title` / `domain_id` into the JWT.
--
-- This is the pattern from the Supabase docs (Auth Hooks → Custom Access Token).
-- ============================================================================

create policy auth_admin_read_profiles
  on public.profiles
  for select
  to supabase_auth_admin
  using (true);

create policy auth_admin_read_role_types
  on public.role_types
  for select
  to supabase_auth_admin
  using (true);
