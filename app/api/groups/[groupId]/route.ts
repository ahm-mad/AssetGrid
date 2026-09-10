import { handler, ok } from '@/lib/api/envelope'
import { ApiError } from '@/lib/api/errors'
import { requirePermission } from '@/lib/auth/guards'
import { getSmsGroup } from '@/lib/sms/groups-data'
import { updateSmsGroup, deleteSmsGroup } from '@/lib/sms/groups-actions'

/**
 * `GET/PUT/DELETE /api/groups/{groupId}` — `TwilioController@editGroup` /
 * `@updateGroup` / `@deleteGroup`.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ groupId: string }> }

export const GET = handler(async (_req: Request, ctx: Ctx) => {
  await requirePermission('messaging', 'read')
  const { groupId } = await ctx.params
  const group = await getSmsGroup(Number(groupId))
  if (!group) throw new ApiError(404, 'Group not found')
  return ok(group)
})

export const PUT = handler(async (req: Request, ctx: Ctx) => {
  const { groupId } = await ctx.params
  const body = await req.json().catch(() => ({}))
  const res = await updateSmsGroup({ ...body, id: Number(groupId) })
  if (!res.ok) {
    if (res.fieldErrors) throw new ApiError(422, 'Validation failed', { fields: res.fieldErrors })
    throw new ApiError(400, res.error ?? 'Could not update the group.')
  }
  const group = await getSmsGroup(Number(groupId))
  return ok(group)
})

export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  const { groupId } = await ctx.params
  const res = await deleteSmsGroup(Number(groupId))
  if (!res.ok) throw new ApiError(400, res.error ?? 'Could not delete the group.')
  return ok({ deleted: true })
})
