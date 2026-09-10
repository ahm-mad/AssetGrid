import 'server-only'

import { createClient } from '@/utils/supabase/server'

export interface RoleModulePermission {
  moduleId: number
  code: string
  canRead: boolean
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
}

export interface RoleMatrixRow {
  id: number
  title: string
  description: string | null
  modules: RoleModulePermission[]
}

/**
 * The role × module permission matrix — mirrors the old `permissions/matrix`
 * endpoint, but deduped (schema-postgres.md §8 / B15). Customer (role 3) has no
 * rows by design.
 */
export async function getRoleMatrix(): Promise<RoleMatrixRow[]> {
  const supabase = await createClient()

  const [{ data: roles }, { data: modules }, { data: perms }] = await Promise.all([
    supabase.from('role_types').select('id, title, description').order('id'),
    supabase.from('modules').select('id, code').order('id'),
    supabase
      .from('role_permissions')
      .select('role_type_id, module_id, can_read, can_create, can_update, can_delete'),
  ])

  type PermRow = NonNullable<typeof perms>[number]
  const permByKey = new Map<string, PermRow>()
  for (const p of perms ?? []) permByKey.set(`${p.role_type_id}:${p.module_id}`, p)

  return (roles ?? []).map((role) => ({
    id: role.id,
    title: role.title,
    description: role.description,
    modules: (modules ?? []).map((m) => {
      const p = permByKey.get(`${role.id}:${m.id}`)
      return {
        moduleId: m.id,
        code: m.code,
        canRead: !!p?.can_read,
        canCreate: !!p?.can_create,
        canUpdate: !!p?.can_update,
        canDelete: !!p?.can_delete,
      }
    }),
  }))
}
