import { handler, ok } from '@/lib/api/envelope'
import { requirePermission } from '@/lib/auth/guards'
import { getRevenueReport } from '@/lib/marina/pms/reports'

/** `GET /api/reports/revenue` — `ReportController@revenuePerSlipDock`. */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = handler(async (req: Request) => {
  await requirePermission('marina', 'read', { allowCustomer: true })
  const q = new URL(req.url).searchParams
  const report = await getRevenueReport({
    marinaId: q.get('marina_id') ? Number(q.get('marina_id')) : undefined,
    month: q.get('month') ? Number(q.get('month')) : undefined,
    year: q.get('year') ? Number(q.get('year')) : undefined,
  })
  return ok({ slip_revenue: report.perSlip, dock_revenue: report.perDock })
})
