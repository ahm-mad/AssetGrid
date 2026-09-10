import 'server-only'

import { createHmac, timingSafeEqual } from 'node:crypto'

import { NextResponse } from 'next/server'

import { ingestUplink } from '@/lib/telemetry/ingest'
import { runAlertEngine } from '@/lib/alerts/engine'

/**
 * Shared sensor-webhook handler, used by both the new
 * `POST /api/webhooks/sensors/[type]` route and the legacy-path alias
 * `POST /api/sensors/[type]`.
 *
 * A9: the old routes had **zero authentication**. We verify an HMAC of the raw
 * body against `SENSOR_WEBHOOK_HMAC_SECRET` when that env var is set; when it is
 * not set (the user hasn't provisioned it with the LNS yet) the check is
 * skipped and a warning is logged, so ingestion still works in dev.
 *
 * The old handlers ran the whole pipeline inline and returned
 * `{ "success": true }` regardless; we return `{ "ok": true }` (the new shape)
 * and never fail the request on a downstream (alert-engine) error.
 */

const KNOWN_TYPES = new Set([
  'data',
  'temp-data',
  'max-notifi-data',
  'bilgi-max-data',
  'gen-max-data',
  'max-temp-data',
  'power-notifi-data',
  'relay-data',
  'max-one-pir',
  'max-ac-r',
  'max-siberia',
  'max-one-storage',
  'aqua-max',
])

function verifyHmac(rawBody: string, header: string | null): boolean {
  const secret = process.env.SENSOR_WEBHOOK_HMAC_SECRET
  if (!secret) {
    console.warn('[sensors] SENSOR_WEBHOOK_HMAC_SECRET not set — skipping signature check (A9)')
    return true
  }
  if (!header) return false
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  const provided = header.replace(/^sha256=/, '')
  const a = Buffer.from(expected)
  const b = Buffer.from(provided)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function handleSensorWebhook(req: Request, type: string): Promise<Response> {
  if (!KNOWN_TYPES.has(type)) {
    return NextResponse.json({ ok: false, error: `unknown sensor type: ${type}` }, { status: 404 })
  }

  const rawBody = await req.text()
  const sig =
    req.headers.get('x-lns-signature') ??
    req.headers.get('x-signature') ??
    req.headers.get('x-hub-signature-256')
  if (!verifyHmac(rawBody, sig)) {
    return NextResponse.json({ ok: false, error: 'invalid signature' }, { status: 401 })
  }

  let body: unknown
  try {
    body = rawBody ? JSON.parse(rawBody) : {}
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid JSON' }, { status: 400 })
  }

  const result = await ingestUplink(type, body)

  if (result.ok && result.telemetryId) {
    try {
      await runAlertEngine({
        type,
        telemetryId: result.telemetryId,
        devEui: result.devEui,
        reading: result.reading,
        previousReading: result.previousReading,
        resolved: result.resolved,
      })
    } catch (e) {
      // The old app returned success even if alerting threw. Match that.
      console.error('[sensors] alert engine failed', e)
    }
  } else if (!result.ok) {
    console.warn(`[sensors] ${type} ingest skipped: ${result.reason}`)
  }

  return NextResponse.json({ ok: true, success: true })
}
