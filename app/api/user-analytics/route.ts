import { handler, ok } from '@/lib/api/envelope'
import { requirePermission } from '@/lib/auth/guards'
import { listDeviceDiagnostics } from '@/lib/analytics/data'

/**
 * `GET /api/user-analytics` — the admin Diagnostics dashboard
 * (`HomeController@analytics`). Scope is RLS on `inventory_devices`; the old
 * per-role branching is gone. Returns the legacy
 * `{ current_page, per_page, total, data }` shape as the envelope `data`.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function intParam(v: string | null): number | undefined {
  if (v == null || v === '') return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

export const GET = handler(async (req: Request) => {
  await requirePermission('inventory', 'read')
  const url = new URL(req.url)
  const q = url.searchParams

  const perPage = intParam(q.get('limit')) ?? 10
  const offset = intParam(q.get('offset')) ?? 0
  const page = Math.floor(offset / Math.max(1, perPage)) + 1

  const result = await listDeviceDiagnostics({
    page,
    perPage,
    companyId: intParam(q.get('company_id')),
    buildingId: intParam(q.get('building_id')),
    marinaId: intParam(q.get('marina_id')),
    search: q.get('search') || undefined,
    alert: q.get('alert') === 'true' ? 'true' : q.get('alert') === 'false' ? 'false' : undefined,
    malfunction:
      q.get('malfunction') === 'true' ? 'true' : q.get('malfunction') === 'false' ? 'false' : undefined,
  })

  return ok({
    current_page: result.page,
    per_page: result.perPage,
    total: result.total,
    data: result.rows,
  })
})
