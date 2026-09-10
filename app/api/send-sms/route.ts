import { handler, ok } from '@/lib/api/envelope'
import { ApiError } from '@/lib/api/errors'
import { sendAdHocSms } from '@/lib/sms/groups-actions'

/** `POST /api/send-sms` — `TwilioController@send`. Was public (A3) — now `messaging,create`. */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = handler(async (req: Request) => {
  const body = await req.json().catch(() => ({}))
  const res = await sendAdHocSms({ to: body.to, message: body.message })
  if (!res.ok) throw new ApiError(400, res.error ?? 'Could not send the message.')
  return ok(res.data)
})
