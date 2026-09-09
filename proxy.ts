import type { NextRequest } from 'next/server'

import { updateSession } from '@/utils/supabase/proxy'

export async function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Run on everything except:
     * - _next/static, _next/image
     * - favicon.ico, robots.txt, sitemap.xml
     * - files with an extension (images, fonts, …)
     * The `/api` routes DO run through proxy (they need the refreshed cookie),
     * but each handler still does its own authz.
     */
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.[\\w]+$).*)',
  ],
}
