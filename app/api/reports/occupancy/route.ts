import { handler, ok } from '@/lib/api/envelope'
import { requirePermission } from '@/lib/auth/guards'
import { getOccupancyReport } from '@/lib/marina/pms/reports'

/**
 * `GET /api/reports/occupancy` — `ReportController@occupancy`. The old API
 * returns a **raw array** `[{dock_id, dock_name, occupancy_percent}]`;
 * reproduced as the envelope `data`.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = handler(async (req: Request) => {
  await requirePermission('marina', 'read', { allowCustomer: true })
  const q = new URL(req.url).searchParams
  const report = await getOccupancyReport({
    marinaId: q.get('marina_id') ? Number(q.get('marina_id')) : undefined,
    start: q.get('start') || undefined,
    end: q.get('end') || undefined,
  })
  return ok(
    report.perDock.map((d) => ({
      dock_id: d.dockId,
      dock_name: d.dockName,
      occupancy_percent: d.occupancyPercent,
    })),
  )
})
