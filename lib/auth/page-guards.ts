import 'server-only'

import { notFound } from 'next/navigation'

import { requireUser } from './dal'
import { can } from './permissions'
import type { CurrentUser, PermissionAction } from './types'

/**
 * Page-level authorization. Redirects to /login if unauthenticated (via
 * requireUser), then 404s if the user lacks the module permission — mirrors the
 * old SPA's `<AuthProtected>` → /access-denied, but a 404 avoids leaking which
 * screens exist. Route Handlers / Server Actions use `lib/auth/guards` instead
 * (they throw 401/403).
 */
export async function requirePagePermission(
  moduleCode: string,
  action: PermissionAction = 'read',
  opts?: { allowCustomer?: boolean },
): Promise<CurrentUser> {
  const user = await requireUser()
  if (user.isSuperAdmin) return user
  if (opts?.allowCustomer && user.isCustomer) return user
  if (!can(user.permissions, moduleCode, action)) notFound()
  return user
}
