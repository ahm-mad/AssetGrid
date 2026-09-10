import Papa from 'papaparse'

import { fail } from '@/lib/api/envelope'
import { requirePermission } from '@/lib/auth/guards'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'

/**
 * `GET /api/export/users-full` — `HomeController@exportUsersFullCsv`. Streams a
 * `users_full_export.csv` of every profile + `profile_details` + role +
 * company. Email comes from `auth.users` (a page-bounded service lookup, gated
 * by the `commerce` read permission on this route).
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const COLUMNS = [
  'User ID',
  'Full Name',
  'Email',
  'Role',
  'Company',
  'Phone',
  'Notification Emails',
  'Notification Phones',
  'Address',
  'City',
  'State',
  'Country',
  'Postal Code',
  'Created At',
]

function jsonList(v: unknown): string {
  if (Array.isArray(v)) return v.filter(Boolean).join(',')
  if (typeof v === 'string' && v.trim()) {
    try {
      const parsed = JSON.parse(v)
      return Array.isArray(parsed) ? parsed.filter(Boolean).join(',') : v
    } catch {
      return v
    }
  }
  return ''
}

export async function GET(): Promise<Response> {
  try {
    await requirePermission('commerce', 'read')

    const supabase = await createClient()
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select(
        'id, legacy_id, first_name, last_name, created_at, deleted_at, role:role_types!profiles_role_type_id_fkey(title), company:companies(company_name), detail:profile_details!profile_details_user_id_fkey(phone_number, notification_email, notification_phone, address_1, city, state, country, postal_code)',
      )
      .is('deleted_at', null)
      .order('legacy_id', { ascending: true, nullsFirst: false })
    if (error) throw error

    const admin = createServiceClient()
    const emailById = new Map<string, string>()
    for (let page = 1; ; page += 1) {
      const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
      if (!data) break
      for (const u of data.users) if (u.email) emailById.set(u.id, u.email)
      if (data.users.length < 1000) break
    }

    const records = (profiles ?? []).map((p) => {
      const detail = (Array.isArray(p.detail) ? p.detail[0] : p.detail) as
        | Record<string, unknown>
        | null
      return [
        p.legacy_id ?? p.id,
        [p.first_name, p.last_name].filter(Boolean).join(' '),
        emailById.get(p.id) ?? '',
        (p.role as { title?: string } | null)?.title ?? '',
        (p.company as { company_name?: string } | null)?.company_name ?? '',
        (detail?.phone_number as string) ?? '',
        jsonList(detail?.notification_email),
        jsonList(detail?.notification_phone),
        (detail?.address_1 as string) ?? '',
        (detail?.city as string) ?? '',
        (detail?.state as string) ?? '',
        (detail?.country as string) ?? '',
        (detail?.postal_code as string) ?? '',
        p.created_at,
      ]
    })

    const csv = Papa.unparse([COLUMNS, ...records])
    return new Response(csv, {
      status: 200,
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': 'attachment; filename="users_full_export.csv"',
        'cache-control': 'no-store',
      },
    })
  } catch (error) {
    return fail(error)
  }
}
