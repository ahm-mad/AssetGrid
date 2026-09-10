import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/database.types'

type Db = SupabaseClient<Database>

/**
 * `profiles` has no email column (it lives in `auth.users`), so the importers
 * that resolve a person by email (inventory `ADMINEMAIL`, building
 * `CustomerEmail`, marina `Customer Email`, customers dedupe) build an
 * email → { userId, companyId } map up front from `auth.admin.listUsers`.
 * Import files are small; one paged sweep is cheap.
 */
export interface UserLookup {
  byEmail: Map<string, { userId: string; companyId: number | null }>
}

export async function buildUserLookup(admin: Db): Promise<UserLookup> {
  const byId = new Map<string, string>() // userId -> lowercased email
  let page = 1
  // supabase-js admin.listUsers is paged; 1000 per page, stop when short.
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) break
    for (const u of data.users) if (u.email) byId.set(u.id, u.email.toLowerCase())
    if (data.users.length < 1000) break
    page += 1
  }

  const byEmail = new Map<string, { userId: string; companyId: number | null }>()
  if (byId.size > 0) {
    const ids = [...byId.keys()]
    // chunk the profiles lookup
    for (let i = 0; i < ids.length; i += 500) {
      const { data } = await admin
        .from('profiles')
        .select('id, company_id')
        .in('id', ids.slice(i, i + 500))
      for (const p of data ?? []) {
        const email = byId.get(p.id)
        if (email) byEmail.set(email, { userId: p.id, companyId: p.company_id ?? null })
      }
    }
  }
  return { byEmail }
}
