import { handler, ok } from '@/lib/api/envelope'
import { ApiError } from '@/lib/api/errors'
import { requirePermission } from '@/lib/auth/guards'
import {
  getMarinaCrmDashboard,
  getOccupancyGraph,
  getRevenueMixGraph,
} from '@/lib/marina/crm-dashboard'

/**
 * `GET /api/marinas/{marina-crm-dashboard, dashboard/occupancy-graph,
 * dashboard/revenue-mix-graph}` — `MarinaController@{MarinaCRMDashboard,
 * occupancyGraph, revenueMixGraph}`. `marina,read` allow-customer; RLS scopes.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = handler(async (req: Request, ctx: { params: Promise<{ path: string[] }> }) => {
  await requirePermission('marina', 'read', { allowCustomer: true })
  const { path } = await ctx.params
  const q = new URL(req.url).searchParams
  const marinaId = q.get('marina_id') ? Number(q.get('marina_id')) : undefined
  const key = path.join('/')

  if (key === 'marina-crm-dashboard') return ok(await getMarinaCrmDashboard(marinaId))
  if (key === 'dashboard/occupancy-graph') return ok(await getOccupancyGraph(marinaId))
  if (key === 'dashboard/revenue-mix-graph') {
    const range = (q.get('range') ?? 'weekly') as 'weekly' | 'monthly' | 'yearly'
    return ok(await getRevenueMixGraph(marinaId, range))
  }
  throw new ApiError(404, `Unknown marinas path: ${key}`)
})
