import { handleSensorWebhook } from '@/lib/telemetry/webhook'

/**
 * Legacy alias — `POST /api/sensors/[type]` (old paths `sensors/temp-data`,
 * `sensors/data`, `sensors/relay-data`, …). Kept working during cutover; the
 * canonical path is `/api/webhooks/sensors/[type]`.
 *
 * The old `GET sensors/*` query routes (`get-data-interval`, `data/{interval}/…`)
 * are NOT handled here — those are app endpoints, ported in a later sub-slice.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(
  req: Request,
  ctx: { params: Promise<{ type: string }> },
): Promise<Response> {
  const { type } = await ctx.params
  return handleSensorWebhook(req, type)
}
