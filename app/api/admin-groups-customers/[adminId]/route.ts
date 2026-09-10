import { handler, ok } from '@/lib/api/envelope'
import { requirePermission } from '@/lib/auth/guards'
import { getAdminGroups } from '@/lib/sms/groups-data'

/**
 * `GET /api/admin-groups-customers/{adminId}` —
 * `TwilioController@adminGroupsRelatedCustomers`.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = handler(async (_req: Request, ctx: { params: Promise<{ adminId: string }> }) => {
  await requirePermission('messaging', 'read')
  const { adminId } = await ctx.params
  return ok(await getAdminGroups(adminId))
})
