import { handler, ok } from '@/lib/api/envelope'
import { requirePermission } from '@/lib/auth/guards'
import { getArAging } from '@/lib/marina/pms/billing-data'

/** `GET /api/invoices/ar-aging` — `InvoiceController@arAging`. */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = handler(async (req: Request) => {
  await requirePermission('marina', 'read', { allowCustomer: true })
  const q = new URL(req.url).searchParams
  const buckets = await getArAging(q.get('marina_id') ? Number(q.get('marina_id')) : undefined)
  return ok(buckets)
})
