import { z } from 'zod'

import { handler, ok } from '@/lib/api/envelope'
import { ApiError } from '@/lib/api/errors'
import { requireAuth } from '@/lib/auth/guards'
import { publishCallEvents, callTopic } from '@/lib/call/broadcast'

/**
 * `POST /api/call/{invite,accept,reject}` — `CallController`. Publishes the
 * WebRTC signalling event(s) on the target's (and, for accept/reject, the
 * caller's) `call:<xnid>` Realtime Broadcast channel.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const inviteSchema = z.object({
  targetXnid: z.string().min(1),
  roomName: z.string().min(1),
  callerXnid: z.string().min(1),
  callerName: z.string().min(1),
})
const answerSchema = z.object({
  callerXnid: z.string().min(1),
  targetXnid: z.string().min(1),
  roomName: z.string().min(1),
})

export const POST = handler(async (req: Request, ctx: { params: Promise<{ action: string }> }) => {
  await requireAuth()
  const { action } = await ctx.params
  const body = await req.json().catch(() => ({}))

  if (action === 'invite') {
    const v = inviteSchema.parse(body)
    const res = await publishCallEvents([
      {
        topic: callTopic(v.targetXnid),
        event: 'incoming.call',
        payload: { roomName: v.roomName, callerXnid: v.callerXnid, callerName: v.callerName },
      },
    ])
    if (!res.ok) throw new ApiError(502, res.error ?? 'Could not send the call invite.')
    return ok({ targetXnid: v.targetXnid, channel: callTopic(v.targetXnid), event: 'incoming.call' })
  }

  if (action === 'accept' || action === 'reject') {
    const v = answerSchema.parse(body)
    const event = action === 'accept' ? 'call.accepted' : 'call.rejected'
    const payload = {
      roomName: v.roomName,
      callerXnid: v.callerXnid,
      [action === 'accept' ? 'acceptedBy' : 'rejectedBy']: v.targetXnid,
      status: action === 'accept' ? 'accepted' : 'rejected',
    }
    const res = await publishCallEvents([
      { topic: callTopic(v.callerXnid), event, payload },
      { topic: callTopic(v.targetXnid), event, payload },
    ])
    if (!res.ok) throw new ApiError(502, res.error ?? `Could not ${action} the call.`)
    return ok({ callerXnid: v.callerXnid, targetXnid: v.targetXnid, roomName: v.roomName, event })
  }

  throw new ApiError(404, `Unknown call action: ${action}`)
})
