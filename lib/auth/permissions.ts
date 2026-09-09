import 'server-only'

import { createClient } from '@/utils/supabase/server'

import type { ModulePermission, PermissionAction } from './types'

type Flags = Pick<ModulePermission, 'can_read' | 'can_create' | 'can_update' | 'can_delete'>

const NONE: Flags = { can_read: false, can_create: false, can_update: false, can_delete: false }
const ALL: Flags = { can_read: true, can_create: true, can_update: true, can_delete: true }

/**
 * Builds the effective permission matrix for a user — mirrors the old
 * `hasAllPermissions` response: user overrides win over role permissions,
 * one row per module. Super Admin gets everything.
 *
 * Runs under the caller's RLS context (role_permissions / user_permissions /
 * modules are all readable by any authenticated user).
 */
export async function getEffectivePermissions(
  userId: string,
  roleTypeId: number,
  roleTitle: string,
): Promise<ModulePermission[]> {
  const supabase = await createClient()

  const [{ data: modules }, { data: rolePerms }, { data: userPerms }] = await Promise.all([
    supabase.from('modules').select('id, code').order('id'),
    supabase
      .from('role_permissions')
      .select('module_id, can_read, can_create, can_update, can_delete')
      .eq('role_type_id', roleTypeId),
    supabase
      .from('user_permissions')
      .select('module_id, can_read, can_create, can_update, can_delete')
      .eq('user_id', userId),
  ])

  const isSuper = roleTitle === 'Super Admin'
  const byRole = new Map<number, Flags>()
  for (const rp of rolePerms ?? []) byRole.set(rp.module_id, flagsOf(rp))
  const byUser = new Map<number, Flags>()
  for (const up of userPerms ?? []) byUser.set(up.module_id, flagsOf(up))

  return (modules ?? []).map((m) => ({
    module_id: m.id,
    code: m.code,
    ...(isSuper ? ALL : (byUser.get(m.id) ?? byRole.get(m.id) ?? NONE)),
  }))
}

function flagsOf(r: Flags): Flags {
  return {
    can_read: r.can_read,
    can_create: r.can_create,
    can_update: r.can_update,
    can_delete: r.can_delete,
  }
}

export function can(
  permissions: ModulePermission[],
  moduleCode: string,
  action: PermissionAction,
): boolean {
  const row = permissions.find((p) => p.code.toLowerCase() === moduleCode.toLowerCase())
  if (!row) return false
  return action === 'read'
    ? row.can_read
    : action === 'create'
      ? row.can_create
      : action === 'update'
        ? row.can_update
        : row.can_delete
}
