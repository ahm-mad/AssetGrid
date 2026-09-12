import 'server-only'

import { createClient } from '@/utils/supabase/server'

export interface UserListRow {
  id: string
  legacyId: number | null
  firstName: string | null
  lastName: string | null
  roleTitle: string
  roleTypeId: number
  companyName: string | null
  createdAt: string
  deletedAt: string | null
}

export interface UserListResult {
  rows: UserListRow[]
  total: number
  page: number
  perPage: number
  totalPages: number
}

export interface UserListParams {
  page?: number
  perPage?: number
  search?: string
  roleTypeId?: number
  includeDeleted?: boolean
}

/**
 * Paginated users list — the `commerce` surface (old `admin/users` /
 * `customers/list`). RLS already restricts what a non-Super-Admin can see;
 * the `commerce` data-scope predicate is layered in a later refinement.
 */
export async function listUsers(params: UserListParams = {}): Promise<UserListResult> {
  const page = Math.max(1, params.page ?? 1)
  const perPage = Math.min(100, Math.max(1, params.perPage ?? 20))
  const from = (page - 1) * perPage
  const to = from + perPage - 1

  const supabase = await createClient()

  let query = supabase
    .from('profiles')
    .select(
      'id, legacy_id, first_name, last_name, role_type_id, created_at, deleted_at, role:role_types!profiles_role_type_id_fkey(title), company:companies(company_name)',
      { count: 'exact' },
    )

  if (!params.includeDeleted) query = query.is('deleted_at', null)
  if (params.roleTypeId) query = query.eq('role_type_id', params.roleTypeId)
  if (params.search?.trim()) {
    const s = params.search.trim().replace(/[%,]/g, '')
    query = query.or(`first_name.ilike.%${s}%,last_name.ilike.%${s}%,xnid.ilike.%${s}%`)
  }

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) throw error

  const total = count ?? 0
  return {
    rows: (data ?? []).map((r) => ({
      id: r.id,
      legacyId: r.legacy_id,
      firstName: r.first_name,
      lastName: r.last_name,
      roleTypeId: r.role_type_id,
      roleTitle: (r.role as { title?: string } | null)?.title ?? '—',
      companyName: (r.company as { company_name?: string } | null)?.company_name ?? null,
      createdAt: r.created_at,
      deletedAt: r.deleted_at,
    })),
    total,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  }
}

export interface CustomerSummary {
  total: number
  companyCount: number
  perCompany: { label: string; value: number }[]
}

/** KPI tiles + per-company breakdown for the customers list page. */
export async function getCustomerSummary(): Promise<CustomerSummary> {
  const supabase = await createClient()
  const [{ count: total }, { data: rows }] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    supabase
      .from('profiles')
      .select('company:companies(company_name)')
      .is('deleted_at', null)
      .not('company_id', 'is', null),
  ])

  const counts = new Map<string, number>()
  for (const r of rows ?? []) {
    const name = (r.company as { company_name?: string } | null)?.company_name ?? 'Unassigned'
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  const perCompany = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value }))

  return { total: total ?? 0, companyCount: perCompany.length, perCompany }
}
