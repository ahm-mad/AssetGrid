import 'server-only'

import { cache } from 'react'
import { redirect } from 'next/navigation'

import { createClient } from '@/utils/supabase/server'

import { getEffectivePermissions } from './permissions'
import { readImpersonation } from './impersonation'
import type { CurrentUser } from './types'

/**
 * The raw Supabase auth claims for this request (from the cookie session),
 * or null. Request-memoised.
 */
export const getClaims = cache(async () => {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  return data?.claims ?? null
})

/**
 * The identity DTO for the current request, or null when unauthenticated.
 * One `profiles` read + the permission matrix, request-memoised. Every Server
 * Component / Route Handler / Server Action that needs identity calls this.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const claims = await getClaims()
  if (!claims?.sub) return null

  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'id, legacy_id, first_name, last_name, role_type_id, company_id, domain_id, role:role_types!profiles_role_type_id_fkey(title)',
    )
    .eq('id', claims.sub)
    .maybeSingle()

  if (!profile) return null

  const roleTitle =
    (profile.role as { title?: string } | null)?.title ?? 'Customer'

  const permissions = await getEffectivePermissions(
    profile.id,
    profile.role_type_id,
    roleTitle,
  )

  const ticket = await readImpersonation()
  const impersonatorId =
    ticket?.actorId ??
    ((claims.app_metadata as { impersonator_id?: string } | undefined)?.impersonator_id ??
      null) ??
    null

  return {
    id: profile.id,
    email: (claims.email as string | undefined) ?? null,
    legacyId: profile.legacy_id,
    firstName: profile.first_name,
    lastName: profile.last_name,
    roleTypeId: profile.role_type_id,
    roleTitle,
    companyId: profile.company_id,
    domainId: profile.domain_id,
    isSuperAdmin: roleTitle === 'Super Admin',
    isCustomer: roleTitle === 'Customer',
    permissions,
    impersonatorId,
  }
})

/** Returns the current user or redirects to /login. Use in protected pages. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return user
}
