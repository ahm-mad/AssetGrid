import { NextResponse } from 'next/server'

import { checkInternalSecret } from '@/lib/internal/auth'
import { runDeviceHealth } from '@/lib/devices/health-run'

/** `POST /api/internal/device-health` — the `device-health:run` job (every 1 min). */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function handle(req: Request): Promise<Response> {
  if (!checkInternalSecret(req)) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }
  const result = await runDeviceHealth()
  return NextResponse.json(result, { status: result.ok ? 200 : 500 })
}

export const POST = handle
export const GET = handle
