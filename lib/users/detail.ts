import 'server-only'

import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { requirePermission } from '@/lib/auth/guards'

export interface UserPermissionOverride {
  moduleId: number
  code: string
  canRead: boolean
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
  hasOverride: boolean
}

export interface UserScopeRow {
  entityType: string
  assetIds: number[]
  assetLabels: { value: number; label: string }[] | null
}

export interface UserDetail {
  id: string
  legacyId: number | null
  email: string | null
  emailConfirmedAt: string | null
  lastSignInAt: string | null
  firstName: string | null
  lastName: string | null
  xnid: string | null
  roleTypeId: number
  roleTitle: string
  companyId: number | null
  companyName: string | null
  domainId: number | null
  residenceCustomer: boolean
  deletedAt: string | null
  createdAt: string
  details: {
    phoneNumber: string | null
    phoneType: string | null
    address1: string | null
    address2: string | null
    city: string | null
    state: string | null
    country: string | null
    postalCode: string | null
    containerCodes: string[]
    inventoryDeviceIds: number[]
  } | null
  permissionOverrides: UserPermissionOverride[]
  scopes: UserScopeRow[]
}

/**
 * Full user record for the admin detail page. Gate first (`commerce.read`),
 * then read `profiles`/`profile_details` under RLS, then look up the email via
 * the auth admin API (email lives in `auth.users`, not `profiles`).
 * Returns null if the profile is not visible to the caller under RLS.
 */
export async function getUserDetail(id: string): Promise<UserDetail | null> {
  await requirePermission('commerce', 'read', { allowCustomer: false })

  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'id, legacy_id, xnid, first_name, last_name, role_type_id, company_id, domain_id, residence_customer, deleted_at, created_at, role:role_types!profiles_role_type_id_fkey(title), company:companies(company_name)',
    )
    .eq('id', id)
    .maybeSingle()

  if (!profile) return null

  const [{ data: details }, { data: modules }, { data: overrides }, { data: scopes }, admin] =
    await Promise.all([
      supabase
        .from('profile_details')
        .select(
          'phone_number, phone_type, address_1, address_2, city, state, country, postal_code, container_codes, inventory_device_ids',
        )
        .eq('user_id', id)
        .maybeSingle(),
      supabase.from('modules').select('id, code').order('id'),
      supabase
        .from('user_permissions')
        .select('module_id, can_read, can_create, can_update, can_delete')
        .eq('user_id', id),
      supabase
        .from('user_scopes')
        .select('entity_type, asset_ids, asset_labels')
        .eq('user_id', id),
      createServiceClient().auth.admin.getUserById(id),
    ])

  const overrideByModule = new Map(
    (overrides ?? []).map((o) => [o.module_id, o] as const),
  )

  return {
    id: profile.id,
    legacyId: profile.legacy_id,
    email: admin.data.user?.email ?? null,
    emailConfirmedAt: admin.data.user?.email_confirmed_at ?? null,
    lastSignInAt: admin.data.user?.last_sign_in_at ?? null,
    firstName: profile.first_name,
    lastName: profile.last_name,
    xnid: profile.xnid,
    roleTypeId: profile.role_type_id,
    roleTitle: (profile.role as { title?: string } | null)?.title ?? '—',
    companyId: profile.company_id,
    companyName: (profile.company as { company_name?: string } | null)?.company_name ?? null,
    domainId: profile.domain_id,
    residenceCustomer: profile.residence_customer,
    deletedAt: profile.deleted_at,
    createdAt: profile.created_at,
    details: details
      ? {
          phoneNumber: details.phone_number,
          phoneType: details.phone_type,
          address1: details.address_1,
          address2: details.address_2,
          city: details.city,
          state: details.state,
          country: details.country,
          postalCode: details.postal_code,
          containerCodes: details.container_codes ?? [],
          inventoryDeviceIds: details.inventory_device_ids ?? [],
        }
      : null,
    permissionOverrides: (modules ?? []).map((m) => {
      const o = overrideByModule.get(m.id)
      return {
        moduleId: m.id,
        code: m.code,
        canRead: !!o?.can_read,
        canCreate: !!o?.can_create,
        canUpdate: !!o?.can_update,
        canDelete: !!o?.can_delete,
        hasOverride: !!o,
      }
    }),
    scopes: (scopes ?? []).map((s) => ({
      entityType: s.entity_type,
      assetIds: s.asset_ids ?? [],
      assetLabels: (s.asset_labels as { value: number; label: string }[] | null) ?? null,
    })),
  }
}

export async function getRoleOptions() {
  const supabase = await createClient()
  const { data } = await supabase.from('role_types').select('id, title').order('id')
  return data ?? []
}
