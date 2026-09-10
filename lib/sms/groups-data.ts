import 'server-only'

import { createClient } from '@/utils/supabase/server'

/**
 * SMS-groups reads — ports `TwilioController@listGroup` / `@editGroup` /
 * `@adminGroupsRelatedCustomers` / `@getAdminList` (`api-inventory.md` §4.13).
 * RLS applies the `messaging` scope; company narrowing is a query filter.
 */

export interface SmsGroupRow {
  id: number
  groupName: string
  adminNumber: string | null
  groupAssignedNum: string
  topic: string | null
  adminId: string | null
  adminName: string | null
  companyId: number | null
  memberCount: number
  createdAt: string
}

export interface SmsGroupMember {
  id: number
  phone: string
  topic: string | null
}

export interface SmsGroupDetail extends SmsGroupRow {
  members: SmsGroupMember[]
  broadcasts: { id: number; topic: string; message: string; phone: string; createdAt: string }[]
}

const GROUP_COLS =
  'id, group_name, admin_number, group_assigned_num, topic, admin_id, company_id, created_at, admin:profiles!sms_groups_admin_id_fkey(first_name, last_name), members:sms_group_registers(count)'

function toRow(r: Record<string, unknown>): SmsGroupRow {
  const admin = r.admin as { first_name?: string | null; last_name?: string | null } | null
  return {
    id: r.id as number,
    groupName: r.group_name as string,
    adminNumber: (r.admin_number as string | null) ?? null,
    groupAssignedNum: r.group_assigned_num as string,
    topic: (r.topic as string | null) ?? null,
    adminId: (r.admin_id as string | null) ?? null,
    adminName: admin ? [admin.first_name, admin.last_name].filter(Boolean).join(' ') || null : null,
    companyId: (r.company_id as number | null) ?? null,
    memberCount: ((r.members as { count: number }[] | null) ?? [])[0]?.count ?? 0,
    createdAt: r.created_at as string,
  }
}

export interface Paginated<T> {
  rows: T[]
  total: number
  page: number
  perPage: number
  totalPages: number
}

export async function listSmsGroups(params: {
  page?: number
  perPage?: number
  search?: string
  companyId?: number
} = {}): Promise<Paginated<SmsGroupRow>> {
  const page = Math.max(1, params.page ?? 1)
  const perPage = Math.min(200, Math.max(1, params.perPage ?? 10))
  const from = (page - 1) * perPage

  const supabase = await createClient()
  let query = supabase.from('sms_groups').select(GROUP_COLS, { count: 'exact' })
  if (params.search) query = query.ilike('group_name', `%${params.search}%`)
  if (params.companyId != null) query = query.eq('company_id', params.companyId)

  const { data, count, error } = await query
    .order('id', { ascending: false })
    .range(from, from + perPage - 1)
  if (error) throw error
  const total = count ?? 0
  return {
    rows: (data ?? []).map((r) => toRow(r as Record<string, unknown>)),
    total,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  }
}

export async function getSmsGroup(id: number): Promise<SmsGroupDetail | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('sms_groups')
    .select(
      'id, group_name, admin_number, group_assigned_num, topic, admin_id, company_id, created_at, admin:profiles!sms_groups_admin_id_fkey(first_name, last_name), members:sms_group_registers(count)',
    )
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null

  const [{ data: members }, { data: broadcasts }] = await Promise.all([
    supabase.from('sms_group_registers').select('id, phone, topic').eq('group_id', id).order('id'),
    supabase
      .from('sms_group_broadcast_messages')
      .select('id, topic, message, phone, created_at')
      .eq('group_id', id)
      .order('id', { ascending: false })
      .limit(50),
  ])

  return {
    ...toRow(data as Record<string, unknown>),
    members: (members ?? []).map((m) => ({ id: m.id, phone: m.phone, topic: m.topic })),
    broadcasts: (broadcasts ?? []).map((b) => ({
      id: b.id,
      topic: b.topic,
      message: b.message,
      phone: b.phone,
      createdAt: b.created_at,
    })),
  }
}

/** `@getAdminList` — Admin-role users (role_type_id 2), for the group admin picker. */
export async function listGroupAdmins(search?: string): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient()
  let query = supabase
    .from('profiles')
    .select('id, first_name, last_name, role:role_types!profiles_role_type_id_fkey(title)')
    .eq('role_type_id', 2)
    .is('deleted_at', null)
  if (search) query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%`)
  const { data } = await query.limit(200)
  return (data ?? []).map((p) => ({
    id: p.id,
    name:
      [p.first_name, p.last_name].filter(Boolean).join(' ') ||
      (p.role as { title?: string } | null)?.title ||
      p.id,
  }))
}

/** `@adminGroupsRelatedCustomers` — the groups an admin owns + their members. */
export async function getAdminGroups(adminId: string): Promise<SmsGroupDetail[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('sms_groups').select('id').eq('admin_id', adminId).order('id')
  const details = await Promise.all((data ?? []).map((g) => getSmsGroup(g.id)))
  return details.filter((d): d is SmsGroupDetail => d != null)
}
