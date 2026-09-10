import { NextResponse } from 'next/server'

import { checkInternalSecret } from '@/lib/internal/auth'
import { runPmsMaintenance } from '@/lib/marina/pms/maintenance'

/**
 * `POST /api/internal/marina-pms-maintenance` — ports the unscheduled Laravel
 * commands `ReleaseExpiredHolds` + `reservations:expire` (tech-debt B22).
 * Invoked by `pg_cron` (N+2) with `x-internal-secret`; `GET` works too for a
 * manual smoke test.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function handle(req: Request): Promise<Response> {
  if (!checkInternalSecret(req)) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }
  const result = await runPmsMaintenance()
  return NextResponse.json(result, { status: result.ok ? 200 : 500 })
}

export const POST = handle
export const GET = handle
