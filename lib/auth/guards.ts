import 'server-only'

import { ApiError, forbidden, unauthorized } from '@/lib/api/errors'
import { createClient } from '@/utils/supabase/server'

import { getCurrentUser } from './dal'
import { can } from './permissions'
import type { CurrentUser, PermissionAction } from './types'

/**
 * These guards are for Route Handlers and Server Actions — they THROW
 * `ApiError` (401/403) which the envelope helper turns into a response.
 * For pages, use `requireUser()` from the DAL (which redirects instead).
 */

export async function requireAuth(): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (!user) throw unauthorized()
  return user
}

export async function requirePermission(
  moduleCode: string,
  action: PermissionAction,
  opts?: { allowCustomer?: boolean },
): Promise<CurrentUser> {
  const user = await requireAuth()
  if (user.isSuperAdmin) return user
  if (opts?.allowCustomer && user.isCustomer) return user
  if (!can(user.permissions, moduleCode, action)) {
    throw forbidden(`Missing permission: ${moduleCode}.${action}`)
  }
  return user
}

/**
 * Data-scope check for one asset id (mirrors ScopeFilter::userCanAccessAsset).
 * Delegates to the `auth_scope_allows` SQL function so the semantics stay in
 * one place. `entity` ∈ building | marina | inventory | commerce | messaging |
 * rule_builder.
 */
export async function requireScope(
  entity: string,
  assetId: number,
): Promise<CurrentUser> {
  const user = await requireAuth()
  if (user.isSuperAdmin) return user

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('auth_scope_allows', {
    p_entity: entity,
    p_asset: assetId,
  })
  if (error) throw new ApiError(500, 'Scope check failed')
  if (data !== true) throw forbidden(`Out of scope for ${entity} #${assetId}`)
  return user
}
