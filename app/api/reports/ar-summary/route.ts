import { handler, ok } from '@/lib/api/envelope'
import { requirePermission } from '@/lib/auth/guards'
import { getArSummary } from '@/lib/marina/pms/reports'

/**
 * `GET /api/reports/ar-summary` — `ReportController@arSummaryPerCompany`.
 * The old endpoint 500'd (undefined `Company::marinas` relation, B41); this
 * rolls up `invoices → marinas → companies` correctly.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = handler(async (req: Request) => {
  await requirePermission('marina', 'read', { allowCustomer: true })
  const q = new URL(req.url).searchParams
  const report = await getArSummary(q.get('marina_id') ? Number(q.get('marina_id')) : undefined)
  return ok(
    report.perCompany.map((c) => ({
      company_id: c.companyId,
      company_name: c.companyName,
      total_ar: c.totalAr,
      ar_aging: c.aging,
    })),
  )
})
