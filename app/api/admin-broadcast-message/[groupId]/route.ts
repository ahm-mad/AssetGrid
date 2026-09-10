import { handler, ok } from '@/lib/api/envelope'
import { ApiError } from '@/lib/api/errors'
import { adminBroadcast } from '@/lib/sms/groups-actions'

/**
 * `POST /api/admin-broadcast-message/{groupId}` —
 * `TwilioController@handleAdminBroadcast`. Accepts `{ message }` (or the old
 * Twilio-style `{ Body }`). Was public in the old app (A3) — now
 * `messaging,create`.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = handler(async (req: Request, ctx: { params: Promise<{ groupId: string }> }) => {
  const { groupId } = await ctx.params
  const body = await req.json().catch(() => ({}))
  const message = body.message ?? body.Body
  const res = await adminBroadcast({ groupId: Number(groupId), message })
  if (!res.ok) throw new ApiError(400, res.error ?? 'Could not broadcast.')
  return ok({ group_id: Number(groupId), total_members: res.data?.recipients ?? 0 })
})
