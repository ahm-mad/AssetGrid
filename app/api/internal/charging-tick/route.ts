import { NextResponse } from 'next/server'

import { checkInternalSecret } from '@/lib/internal/auth'
import { runChargingTick } from '@/lib/charging/tick'

/**
 * `POST /api/internal/charging-tick` — the 30-second charging/schedule loop.
 * Invoked by `pg_cron` (N+2) with `x-internal-secret`. Also acceptable as a
 * `GET` for a browser / external-cron smoke test.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function handle(req: Request): Promise<Response> {
  if (!checkInternalSecret(req)) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }
  const result = await runChargingTick()
  return NextResponse.json(result, { status: result.ok ? 200 : 500 })
}

export const POST = handle
export const GET = handle
