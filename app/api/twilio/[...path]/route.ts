import { handler, ok } from '@/lib/api/envelope'
import { ApiError } from '@/lib/api/errors'
import { requirePermission } from '@/lib/auth/guards'
import {
  listPhoneNumbers,
  getPhoneNumberDetails,
  listMessages,
  getMessageStats,
  getWebhookLogs,
  updatePhoneNumberWebhooks,
} from '@/lib/sms/twilio-numbers'

/**
 * `GET/PUT /api/twilio/*` — `TwilioController` number-management surface
 * (`numbers`, `number/{n}/details|incoming|outgoing|messages|stats`,
 * `number/{sid}/webhooks`, `webhook-logs`). Was entirely public (A3) — now
 * `messaging,read` / `messaging,update`. Pure Twilio-REST passthroughs; each
 * returns `{ configured: false }` until Twilio has credentials (ADR-036).
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ path: string[] }> }

export const GET = handler(async (_req: Request, ctx: Ctx) => {
  await requirePermission('messaging', 'read')
  const { path } = await ctx.params

  if (path.length === 1 && path[0] === 'numbers') return ok(await listPhoneNumbers())
  if (path.length === 1 && path[0] === 'webhook-logs') return ok(await getWebhookLogs())

  if (path[0] === 'number' && path.length === 3) {
    const number = decodeURIComponent(path[1])
    switch (path[2]) {
      case 'details':
        return ok(await getPhoneNumberDetails(number))
      case 'incoming':
        return ok(await listMessages(number, 'inbound'))
      case 'outgoing':
        return ok(await listMessages(number, 'outbound'))
      case 'messages':
        return ok(await listMessages(number, 'all'))
      case 'stats':
        return ok(await getMessageStats(number))
    }
  }
  throw new ApiError(404, `Unknown twilio path: ${path.join('/')}`)
})

export const PUT = handler(async (req: Request, ctx: Ctx) => {
  await requirePermission('messaging', 'update')
  const { path } = await ctx.params
  if (path[0] === 'number' && path.length === 3 && path[2] === 'webhooks') {
    const body = await req.json().catch(() => ({}))
    return ok(await updatePhoneNumberWebhooks(decodeURIComponent(path[1]), body))
  }
  throw new ApiError(404, `Unknown twilio path: ${path.join('/')}`)
})
