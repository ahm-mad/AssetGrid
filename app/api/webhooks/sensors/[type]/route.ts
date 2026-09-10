import { handleSensorWebhook } from '@/lib/telemetry/webhook'

/**
 * `POST /api/webhooks/sensors/[type]` — the new LNS sensor-uplink ingress.
 * One handler for all ~14 sensor kinds (`06-webhooks-iot.md` §7).
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
