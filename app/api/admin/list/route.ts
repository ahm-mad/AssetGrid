import { handler, ok } from '@/lib/api/envelope'
import { requirePermission } from '@/lib/auth/guards'
import { listGroupAdmins } from '@/lib/sms/groups-data'

/** `GET /api/admin/list` — `TwilioController@getAdminList` (Admin-role users). */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = handler(async (req: Request) => {
  await requirePermission('messaging', 'read')
  const search = new URL(req.url).searchParams.get('search') || undefined
  return ok(await listGroupAdmins(search))
})
