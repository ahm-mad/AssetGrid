import { handler, ok } from '@/lib/api/envelope'
import { ApiError } from '@/lib/api/errors'
import { createSmsGroup } from '@/lib/sms/groups-actions'

/** `POST /api/create-group` — `TwilioController@adminBulkSubscribeToGroup`. */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = handler(async (req: Request) => {
  const body = await req.json().catch(() => ({}))
  const res = await createSmsGroup(body)
  if (!res.ok) {
    if (res.fieldErrors) throw new ApiError(422, 'Validation failed', { fields: res.fieldErrors })
    throw new ApiError(400, res.error ?? 'Could not create the group.')
  }
  return ok(res.data)
})
