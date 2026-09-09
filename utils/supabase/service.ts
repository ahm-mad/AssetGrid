import 'server-only'

import { createClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/database.types'

/**
 * Service-role Supabase client. **Bypasses RLS.**
 *
 * Use only for work that legitimately runs outside a user's authority:
 * the ETL, webhook handlers (Stripe / Twilio / sensors), the impersonation
 * endpoint, admin-only Server Actions, and the scheduled runners.
 *
 * Never import this from a Client Component or expose its result to the
 * browser. `server-only` makes a client-bundle import a build error.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_SECRET

  if (!url || !secret) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_SECRET',
    )
  }

  return createClient<Database>(url, secret, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
