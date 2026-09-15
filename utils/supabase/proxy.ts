import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import type { Database } from '@/lib/database.types'
import { UI_MOCK } from '@/lib/mock/enabled'

/** Route-group prefixes that require an authenticated session. */
const PROTECTED_PREFIXES = ['/app', '/admin']
/** Prefixes only Super Admin may reach (optimistic — real check is in the DAL). */
const ADMIN_PREFIXES = ['/admin']
/** Auth pages an already-signed-in user is bounced away from. */
const AUTH_PREFIXES = ['/login', '/register', '/forgot-password', '/reset-password']

/**
 * Refreshes the Supabase auth cookie and does **optimistic** route gating.
 * No database reads — only what is in the session JWT (see the
 * `custom_access_token_hook`, which stamps `app_metadata.role_title`).
 * Real authorization happens in `lib/auth` (DAL + guards).
 */
export async function updateSession(request: NextRequest) {
  // UI-only session (see lib/mock/enabled.ts) — the real Supabase project is
  // torn down, so skip the network round-trip and route gating entirely and
  // let every request through; the mock DAL supplies a Super Admin identity.
  if (UI_MOCK) return NextResponse.next({ request })

  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // IMPORTANT: getClaims() / getUser() must be called to refresh the token.
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims ?? null

  const path = request.nextUrl.pathname
  const isProtected = PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))
  const isAdmin = ADMIN_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))
  const isAuthPage = AUTH_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))

  if (!claims && isProtected) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', path)
    return NextResponse.redirect(url)
  }

  if (claims && isAuthPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/app'
    url.search = ''
    return NextResponse.redirect(url)
  }

  if (claims && isAdmin) {
    const roleTitle = (claims.app_metadata as { role_title?: string } | undefined)?.role_title
    if (roleTitle && roleTitle !== 'Super Admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/app'
      url.search = ''
      return NextResponse.redirect(url)
    }
  }

  return response
}
