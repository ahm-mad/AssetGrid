import { handler, ok } from '@/lib/api/envelope'
import { requirePermission } from '@/lib/auth/guards'
import { listSmsGroups } from '@/lib/sms/groups-data'

/** `GET /api/list-groups` — `TwilioController@listGroup`. */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = handler(async (req: Request) => {
  await requirePermission('messaging', 'read')
  const q = new URL(req.url).searchParams
  const limit = Number(q.get('limit') ?? 10)
  const offset = Number(q.get('offset') ?? 0)
  const result = await listSmsGroups({
    perPage: limit === -1 ? 200 : limit,
    page: limit > 0 ? Math.floor(offset / limit) + 1 : 1,
    search: q.get('search') || undefined,
    companyId: q.get('company_id') ? Number(q.get('company_id')) : undefined,
  })
  return ok({
    current_page: result.page,
    per_page: result.perPage,
    total: result.total,
    data: result.rows,
  })
})
