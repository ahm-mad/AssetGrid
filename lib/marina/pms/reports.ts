import 'server-only'

import { createClient } from '@/utils/supabase/server'

/**
 * Marina PMS reports — ports `ReportController@revenuePerSlipDock` / `@occupancy`
 * / `@arSummaryPerCompany` (`api-inventory.md` §4.9). Aggregated in TS over
 * RLS-scoped queries (reports are low-volume); `marinaId` narrows the scope.
 *
 * `ar-summary` is **fixed** here (tech-debt B41): the old code called an
 * undefined `Company::marinas` relation and 500'd. `invoices` now carries a
 * denormalised `marina_id`, so AR rolls up `invoices → marinas → companies`
 * directly.
 */

function daysBetween(a: string, b: string): number {
  return Math.max(0, Math.floor((Date.parse(b) - Date.parse(a)) / 86_400_000))
}

export interface RevenueReport {
  perSlip: { slipId: number; slipName: string; revenue: number }[]
  perDock: { dockId: number; dockName: string; revenue: number }[]
}

/** `ReportController@revenuePerSlipDock` — sum of `reservations.total` for a month. */
export async function getRevenueReport(params: {
  marinaId?: number
  month?: number
  year?: number
}): Promise<RevenueReport> {
  const now = new Date()
  const month = params.month ?? now.getUTCMonth() + 1
  const year = params.year ?? now.getUTCFullYear()
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const endMonth = month === 12 ? 1 : month + 1
  const endYear = month === 12 ? year + 1 : year
  const end = `${endYear}-${String(endMonth).padStart(2, '0')}-01`

  const supabase = await createClient()
  let slipQ = supabase.from('slips').select('id, name, dock_id, dock:docks(name)')
  if (params.marinaId != null) slipQ = slipQ.eq('marina_id', params.marinaId)
  const { data: slips } = await slipQ

  let resQ = supabase
    .from('reservations')
    .select('slip_id, dock_id, total, start_date')
    .gte('start_date', start)
    .lt('start_date', end)
  if (params.marinaId != null) resQ = resQ.eq('marina_id', params.marinaId)
  const { data: reservations } = await resQ

  const bySlip = new Map<number, number>()
  const byDock = new Map<number, number>()
  for (const r of reservations ?? []) {
    const amt = Number(r.total ?? 0)
    if (r.slip_id != null) bySlip.set(r.slip_id, (bySlip.get(r.slip_id) ?? 0) + amt)
    if (r.dock_id != null) byDock.set(r.dock_id, (byDock.get(r.dock_id) ?? 0) + amt)
  }

  const dockNames = new Map<number, string>()
  const perSlip = (slips ?? []).map((s) => {
    if (s.dock_id != null)
      dockNames.set(s.dock_id, (s.dock as { name?: string | null } | null)?.name ?? `Dock ${s.dock_id}`)
    return { slipId: s.id, slipName: s.name, revenue: bySlip.get(s.id) ?? 0 }
  })
  const perDock = [...byDock.entries()]
    .map(([dockId, revenue]) => ({ dockId, dockName: dockNames.get(dockId) ?? `Dock ${dockId}`, revenue }))
    .sort((a, b) => b.revenue - a.revenue)

  return { perSlip, perDock }
}

export interface OccupancyReport {
  perDock: { dockId: number; dockName: string; occupancyPercent: number }[]
}

/** `ReportController@occupancy` — occupied slip-days / total slip-days per dock. */
export async function getOccupancyReport(params: {
  marinaId?: number
  start?: string
  end?: string
}): Promise<OccupancyReport> {
  const now = new Date()
  const start = params.start ?? `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`
  const end = params.end ?? new Date(now.getUTCFullYear(), now.getUTCMonth() + 1, 0).toISOString().slice(0, 10)
  const windowDays = Math.max(1, daysBetween(start, end))

  const supabase = await createClient()
  let dockQ = supabase.from('docks').select('id, name, slips(id)')
  if (params.marinaId != null) dockQ = dockQ.eq('marina_id', params.marinaId)
  const { data: docks } = await dockQ

  let resQ = supabase.from('reservations').select('dock_id, start_date, end_date, status')
  if (params.marinaId != null) resQ = resQ.eq('marina_id', params.marinaId)
  const { data: reservations } = await resQ

  const occupiedByDock = new Map<number, number>()
  for (const r of reservations ?? []) {
    if (r.dock_id == null || !r.start_date || !r.end_date) continue
    const s = r.start_date > start ? r.start_date : start
    const e = r.end_date < end ? r.end_date : end
    if (s < e) occupiedByDock.set(r.dock_id, (occupiedByDock.get(r.dock_id) ?? 0) + daysBetween(s, e))
  }

  const perDock = (docks ?? []).map((d) => {
    const slipCount = ((d.slips as { id: number }[] | null) ?? []).length
    const totalDays = slipCount * windowDays
    const occupied = occupiedByDock.get(d.id) ?? 0
    return {
      dockId: d.id,
      dockName: d.name,
      occupancyPercent: totalDays ? Math.round((occupied / totalDays) * 10000) / 100 : 0,
    }
  })
  return { perDock }
}

export interface ArSummaryReport {
  perCompany: {
    companyId: number
    companyName: string
    totalAr: number
    aging: { '0-30': number; '31-60': number; '61-90': number; '90+': number }
  }[]
}

/** `ReportController@arSummaryPerCompany` — FIXED (B41). */
export async function getArSummary(marinaId?: number): Promise<ArSummaryReport> {
  const supabase = await createClient()

  let marinaQ = supabase.from('marinas').select('id, company_id, company:companies(company_name)')
  if (marinaId != null) marinaQ = marinaQ.eq('id', marinaId)
  const { data: marinas } = await marinaQ
  const marinaToCompany = new Map<number, { id: number | null; name: string }>()
  for (const m of marinas ?? []) {
    marinaToCompany.set(m.id, {
      id: m.company_id,
      name: (m.company as { company_name?: string | null } | null)?.company_name ?? 'Unassigned',
    })
  }

  let invQ = supabase.from('invoices').select('marina_id, amount, status, created_at')
  if (marinaId != null) invQ = invQ.eq('marina_id', marinaId)
  const { data: invoices } = await invQ

  const now = Date.now()
  const perCompany = new Map<
    string,
    ArSummaryReport['perCompany'][number]
  >()

  for (const inv of invoices ?? []) {
    if (inv.marina_id == null) continue
    const co = marinaToCompany.get(inv.marina_id)
    if (!co) continue
    const key = String(co.id ?? `name:${co.name}`)
    let row = perCompany.get(key)
    if (!row) {
      row = {
        companyId: co.id ?? 0,
        companyName: co.name,
        totalAr: 0,
        aging: { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 },
      }
      perCompany.set(key, row)
    }
    const amt = Number(inv.amount ?? 0)
    row.totalAr += amt
    if (inv.status === 'unpaid' || inv.status === 'partially_paid') {
      const days = Math.floor((now - new Date(inv.created_at as string).getTime()) / 86_400_000)
      if (days <= 30) row.aging['0-30'] += amt
      else if (days <= 60) row.aging['31-60'] += amt
      else if (days <= 90) row.aging['61-90'] += amt
      else row.aging['90+'] += amt
    }
  }

  return { perCompany: [...perCompany.values()].sort((a, b) => b.totalAr - a.totalAr) }
}
