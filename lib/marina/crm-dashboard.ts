import 'server-only'

import { createClient } from '@/utils/supabase/server'

/**
 * Marina CRM dashboards — ports `MarinaController@{MarinaCRMDashboard,
 * occupancyGraph, revenueMixGraph}` (`api-inventory.md` §4.9). The old versions
 * were ~400 lines of nested eager-loads; these are compact windowed
 * aggregations over the slice-7/8 tables. RLS applies the `marina` scope.
 */

export interface MarinaCrmRow {
  marinaId: number
  marinaName: string
  marinaCode: string
  boatCounts: { moor: number; dry: number; wet: number; other: number }
  slips: { total: number; occupied: number; occupancyPercent: number }
  reservations: { total: number; confirmed: number; pending: number; waitlisted: number }
  activeContracts: number
  revenueThisMonth: number
}

export async function getMarinaCrmDashboard(marinaId?: number): Promise<MarinaCrmRow[]> {
  const supabase = await createClient()

  let marinaQ = supabase.from('marinas').select('id, marina_name, marina_code')
  if (marinaId != null) marinaQ = marinaQ.eq('id', marinaId)
  const { data: marinas } = await marinaQ.order('marina_code')
  if (!marinas || marinas.length === 0) return []
  const ids = marinas.map((m) => m.id)

  const monthStart = new Date()
  monthStart.setUTCDate(1)
  const monthStartIso = monthStart.toISOString().slice(0, 10)

  const [{ data: boats }, { data: slips }, { data: assignments }, { data: reservations }, { data: contracts }] =
    await Promise.all([
      supabase.from('boats').select('marina_id, storage_status').in('marina_id', ids),
      supabase.from('slips').select('id, marina_id').in('marina_id', ids),
      supabase
        .from('assignments')
        .select('marina_id, slip_id')
        .in('marina_id', ids)
        .in('status', ['assigned', 'occupied']),
      supabase.from('reservations').select('marina_id, status, total, start_date').in('marina_id', ids),
      supabase.from('contracts').select('marina_id, status').in('marina_id', ids),
    ])

  return marinas.map((m) => {
    const bc = { moor: 0, dry: 0, wet: 0, other: 0 }
    for (const b of boats ?? []) {
      if (b.marina_id !== m.id) continue
      const s = (b.storage_status ?? '').toLowerCase()
      if (s === 'moor') bc.moor += 1
      else if (s === 'dry') bc.dry += 1
      else if (s === 'wet') bc.wet += 1
      else bc.other += 1
    }
    const slipTotal = (slips ?? []).filter((s) => s.marina_id === m.id).length
    const occupied = new Set(
      (assignments ?? []).filter((a) => a.marina_id === m.id).map((a) => a.slip_id).filter((x) => x != null),
    ).size
    const res = (reservations ?? []).filter((r) => r.marina_id === m.id)
    const revenueThisMonth = res
      .filter((r) => (r.start_date ?? '') >= monthStartIso)
      .reduce((sum, r) => sum + Number(r.total ?? 0), 0)

    return {
      marinaId: m.id,
      marinaName: m.marina_name ?? m.marina_code,
      marinaCode: m.marina_code,
      boatCounts: bc,
      slips: {
        total: slipTotal,
        occupied,
        occupancyPercent: slipTotal ? Math.round((occupied / slipTotal) * 10000) / 100 : 0,
      },
      reservations: {
        total: res.length,
        confirmed: res.filter((r) => r.status === 'confirmed').length,
        pending: res.filter((r) => r.status === 'pending').length,
        waitlisted: res.filter((r) => r.status === 'waitlisted').length,
      },
      activeContracts: (contracts ?? []).filter(
        (c) => c.marina_id === m.id && ['signed', 'active'].includes(c.status),
      ).length,
      revenueThisMonth,
    }
  })
}

// ---------------------------------------------------------------------------
export interface GraphSeries {
  labels: string[]
  series: { name: string; data: number[] }[]
}

/** `@occupancyGraph` — occupancy % vs waitlist requests over the last 7 days. */
export async function getOccupancyGraph(marinaId?: number): Promise<GraphSeries> {
  const supabase = await createClient()
  let slipQ = supabase.from('slips').select('id')
  if (marinaId != null) slipQ = slipQ.eq('marina_id', marinaId)
  const { data: slips } = await slipQ
  const slipTotal = (slips ?? []).length

  let resQ = supabase.from('reservations').select('status, start_date, end_date, created_at')
  if (marinaId != null) resQ = resQ.eq('marina_id', marinaId)
  const { data: reservations } = await resQ

  const labels: string[] = []
  const occupancy: number[] = []
  const waitlist: number[] = []
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setUTCDate(now.getUTCDate() - now.getUTCDay())

  for (let i = 0; i < 7; i += 1) {
    const day = new Date(weekStart)
    day.setUTCDate(weekStart.getUTCDate() + i)
    const d = day.toISOString().slice(0, 10)
    labels.push(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day.getUTCDay()])

    const activeThatDay = (reservations ?? []).filter(
      (r) =>
        ['confirmed', 'contract_signed', 'active'].includes(r.status) &&
        (r.start_date ?? '') <= d &&
        (r.end_date ?? '') >= d,
    ).length
    occupancy.push(slipTotal ? Math.round((activeThatDay / slipTotal) * 10000) / 100 : 0)
    waitlist.push(
      (reservations ?? []).filter(
        (r) => r.status === 'waitlisted' && (r.created_at ?? '').slice(0, 10) === d,
      ).length,
    )
  }

  return {
    labels,
    series: [
      { name: 'Occupancy', data: occupancy },
      { name: 'Waitlist Requests', data: waitlist },
    ],
  }
}

/** `@revenueMixGraph` — slip revenue vs fuel/service revenue over a range. */
export async function getRevenueMixGraph(
  marinaId?: number,
  range: 'weekly' | 'monthly' | 'yearly' = 'weekly',
): Promise<GraphSeries> {
  const supabase = await createClient()

  const buckets: { label: string; start: string; end: string }[] = []
  const now = new Date()
  if (range === 'weekly') {
    const weekStart = new Date(now)
    weekStart.setUTCDate(now.getUTCDate() - now.getUTCDay())
    for (let i = 0; i < 7; i += 1) {
      const day = new Date(weekStart)
      day.setUTCDate(weekStart.getUTCDate() + i)
      const d = day.toISOString().slice(0, 10)
      buckets.push({ label: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day.getUTCDay()], start: d, end: d })
    }
  } else if (range === 'monthly') {
    for (let i = 5; i >= 0; i -= 1) {
      const s = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
      const e = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 0))
      buckets.push({
        label: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][s.getUTCMonth()],
        start: s.toISOString().slice(0, 10),
        end: e.toISOString().slice(0, 10),
      })
    }
  } else {
    for (let i = 4; i >= 0; i -= 1) {
      const y = now.getUTCFullYear() - i
      buckets.push({ label: String(y), start: `${y}-01-01`, end: `${y}-12-31` })
    }
  }

  let resQ = supabase.from('reservations').select('total, created_at')
  if (marinaId != null) resQ = resQ.eq('marina_id', marinaId)
  const { data: reservations } = await resQ

  let posQ = supabase.from('pos_transactions').select('amount, service_category, created_at')
  if (marinaId != null) posQ = posQ.eq('marina_id', marinaId)
  const { data: pos } = await posQ

  const slipRevenue: number[] = []
  const serviceRevenue: number[] = []
  for (const b of buckets) {
    const inRange = (ts: string | null) => {
      const d = (ts ?? '').slice(0, 10)
      return d >= b.start && d <= b.end
    }
    slipRevenue.push(
      Math.round(
        (reservations ?? []).filter((r) => inRange(r.created_at)).reduce((s, r) => s + Number(r.total ?? 0), 0) *
          100,
      ) / 100,
    )
    serviceRevenue.push(
      Math.round(
        (pos ?? [])
          .filter(
            (p) => inRange(p.created_at) && ['fuel', 'service', 'services'].includes(p.service_category ?? ''),
          )
          .reduce((s, p) => s + Number(p.amount ?? 0), 0) * 100,
      ) / 100,
    )
  }

  return {
    labels: buckets.map((b) => b.label),
    series: [
      { name: 'Slips', data: slipRevenue },
      { name: 'Fuel & Services', data: serviceRevenue },
    ],
  }
}
