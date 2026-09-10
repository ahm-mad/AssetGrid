import 'server-only'

import { timingSafeEqual } from 'node:crypto'

/**
 * Shared-secret gate for the internal scheduled-runner endpoints
 * (`app/api/internal/*`). These are invoked by `pg_cron` → `pg_net` (or an
 * external cron) with the secret in an `x-internal-secret` header — NOT by a
 * user, so there is no Supabase session.
 *
 * When `INTERNAL_FUNCTION_SECRET` is unset the gate is OPEN in development so
 * the runners can be exercised locally; set the env var in any deployed
 * environment. The N+2 integrations phase wires the `pg_cron` schedules.
 */
export function checkInternalSecret(req: Request): boolean {
  const secret = process.env.INTERNAL_FUNCTION_SECRET
  if (!secret) {
    console.warn('[internal] INTERNAL_FUNCTION_SECRET not set — internal route is UNGATED (dev only)')
    return true
  }
  const provided = req.headers.get('x-internal-secret') ?? ''
  const a = Buffer.from(provided)
  const b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}
