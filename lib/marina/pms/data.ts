import 'server-only'

import { createClient } from '@/utils/supabase/server'

/**
 * Marina PMS reads — ports the read side of `RatePlanController`,
 * `QuoteController`, `ReservationController` (`api-inventory.md` §4.9). RLS
 * applies the `marina` scope; these functions never branch on role.
 *
 * The old `index`/`show` endpoints lazily flipped an expired hold to
 * `status = 'expired'` on read. That write is moved to the scheduled
 * maintenance route (`/api/internal/marina-pms-maintenance`, ports
 * `ReleaseExpiredHolds` + `ExpireReservations` — B22); reads here just report
 * `holdActive` / `secondsRemaining` derived from `hold_expires_at`.
 */

export interface Paginated<T> {
  rows: T[]
  total: number
  page: number
  perPage: number
  totalPages: number
}

function paginate<T>(rows: T[], total: number, page: number, perPage: number): Paginated<T> {
  return { rows, total, page, perPage, totalPages: Math.max(1, Math.ceil(total / perPage)) }
}

// ---------------------------------------------------------------------------
// rate plans
// ---------------------------------------------------------------------------
export interface RatePlanRow {
  id: number
  name: string | null
  calcType: string | null
  rate: number | null
  startDate: string | null
  endDate: string | null
  type: 'percent' | 'fixed' | null
  condition: unknown
  loaUnit: string | null
  value: number | null
  marinaId: number
  createdAt: string
}

const RATE_PLAN_COLS =
  'id, name, calc_type, rate, start_date, end_date, type, condition, loa_unit, value, marina_id, created_at'

function toRatePlan(r: Record<string, unknown>): RatePlanRow {
  return {
    id: r.id as number,
    name: (r.name as string | null) ?? null,
    calcType: (r.calc_type as string | null) ?? null,
    rate: r.rate == null ? null : Number(r.rate),
    startDate: (r.start_date as string | null) ?? null,
    endDate: (r.end_date as string | null) ?? null,
    type: (r.type as 'percent' | 'fixed' | null) ?? null,
    condition: r.condition ?? null,
    loaUnit: (r.loa_unit as string | null) ?? null,
    value: r.value == null ? null : Number(r.value),
    marinaId: r.marina_id as number,
    createdAt: r.created_at as string,
  }
}

export async function listRatePlans(params: {
  page?: number
  perPage?: number
  search?: string
  calcType?: string
  marinaId?: number
} = {}): Promise<Paginated<RatePlanRow>> {
  const page = Math.max(1, params.page ?? 1)
  const perPage = Math.min(100, Math.max(1, params.perPage ?? 15))
  const from = (page - 1) * perPage

  const supabase = await createClient()
  let query = supabase.from('rate_plans').select(RATE_PLAN_COLS, { count: 'exact' })
  if (params.search) query = query.ilike('name', `%${params.search}%`)
  if (params.calcType) query = query.eq('calc_type', params.calcType)
  if (params.marinaId != null) query = query.eq('marina_id', params.marinaId)

  const { data, count, error } = await query
    .order('start_date', { ascending: true, nullsFirst: true })
    .range(from, from + perPage - 1)
  if (error) throw error
  return paginate((data ?? []).map((r) => toRatePlan(r as Record<string, unknown>)), count ?? 0, page, perPage)
}

export async function getRatePlan(id: number): Promise<RatePlanRow | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('rate_plans').select(RATE_PLAN_COLS).eq('id', id).maybeSingle()
  if (error) throw error
  return data ? toRatePlan(data as Record<string, unknown>) : null
}

export async function getRatePlanOptions(marinaId: number): Promise<{ id: number; name: string; calcType: string | null }[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('rate_plans')
    .select('id, name, calc_type')
    .eq('marina_id', marinaId)
    .order('name')
  return (data ?? []).map((r) => ({ id: r.id, name: r.name ?? `Plan #${r.id}`, calcType: r.calc_type }))
}

// ---------------------------------------------------------------------------
// quotes
// ---------------------------------------------------------------------------
export interface QuoteRow {
  id: number
  xnid: string | null
  status: string | null
  marinaId: number | null
  slipId: number | null
  ratePlanId: number
  ratePlanName: string | null
  reservationId: number | null
  loa: number | null
  startDate: string | null
  endDate: string | null
  rate: number | null
  total: number | null
  discount: number | null
  discountType: string | null
  surcharge: number | null
  holdExpiresAt: string | null
  holdActive: boolean
  secondsRemaining: number
  createdAt: string
}

const QUOTE_COLS =
  'id, xnid, status, marina_id, slip_id, rate_plan_id, reservation_id, loa, start_date, end_date, rate, total, discount, discount_type, surcharge, hold_expires_at, created_at, rate_plan:rate_plans(name)'

function toQuote(r: Record<string, unknown>): QuoteRow {
  const holdExpiresAt = (r.hold_expires_at as string | null) ?? null
  const expired = holdExpiresAt != null && new Date(holdExpiresAt).getTime() <= Date.now()
  const secondsRemaining =
    holdExpiresAt == null || expired
      ? 0
      : Math.max(0, Math.floor((new Date(holdExpiresAt).getTime() - Date.now()) / 1000))
  return {
    id: r.id as number,
    xnid: (r.xnid as string | null) ?? null,
    status: (r.status as string | null) ?? null,
    marinaId: (r.marina_id as number | null) ?? null,
    slipId: (r.slip_id as number | null) ?? null,
    ratePlanId: r.rate_plan_id as number,
    ratePlanName: (r.rate_plan as { name?: string | null } | null)?.name ?? null,
    reservationId: (r.reservation_id as number | null) ?? null,
    loa: r.loa == null ? null : Number(r.loa),
    startDate: (r.start_date as string | null) ?? null,
    endDate: (r.end_date as string | null) ?? null,
    rate: r.rate == null ? null : Number(r.rate),
    total: r.total == null ? null : Number(r.total),
    discount: r.discount == null ? null : Number(r.discount),
    discountType: (r.discount_type as string | null) ?? null,
    surcharge: r.surcharge == null ? null : Number(r.surcharge),
    holdExpiresAt,
    holdActive: holdExpiresAt != null && !expired,
    secondsRemaining,
    createdAt: r.created_at as string,
  }
}

export async function listQuotes(params: {
  page?: number
  perPage?: number
  status?: string
  marinaId?: number
  startDate?: string
  endDate?: string
} = {}): Promise<Paginated<QuoteRow>> {
  const page = Math.max(1, params.page ?? 1)
  const perPage = Math.min(100, Math.max(1, params.perPage ?? 20))
  const from = (page - 1) * perPage

  const supabase = await createClient()
  let query = supabase.from('quotes').select(QUOTE_COLS, { count: 'exact' })
  if (params.status) query = query.in('status', params.status.split(','))
  if (params.marinaId != null) query = query.eq('marina_id', params.marinaId)
  if (params.startDate && params.endDate)
    query = query.gte('start_date', params.startDate).lte('start_date', params.endDate)

  const { data, count, error } = await query
    .order('id', { ascending: false })
    .range(from, from + perPage - 1)
  if (error) throw error
  return paginate((data ?? []).map((r) => toQuote(r as Record<string, unknown>)), count ?? 0, page, perPage)
}

export async function getQuote(id: number): Promise<QuoteRow | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('quotes').select(QUOTE_COLS).eq('id', id).maybeSingle()
  if (error) throw error
  return data ? toQuote(data as Record<string, unknown>) : null
}

// ---------------------------------------------------------------------------
// reservations
// ---------------------------------------------------------------------------
export interface ReservationRow {
  id: number
  xnid: string | null
  status: string
  marinaId: number | null
  dockId: number | null
  dockName: string | null
  boatId: number | null
  boatName: string | null
  slipId: number | null
  ratePlanId: number | null
  ratePlanName: string | null
  quoteId: number | null
  userId: string | null
  loa: number | null
  startDate: string | null
  endDate: string | null
  days: number | null
  rate: number | null
  subtotal: number
  tax: number
  total: number
  billedBy: string | null
  assignmentStatus: string | null
  stayStatus: string | null
  createdAt: string
}

const RESERVATION_LIST_COLS =
  'id, xnid, status, marina_id, dock_id, boat_id, slip_id, rate_plan_id, quote_id, user_id, loa, start_date, end_date, days, rate, subtotal, tax, total, billed_by, created_at, dock:docks(name), boat:boats(boat_name), rate_plan:rate_plans(name), assignments(status), stays(status)'

function toReservation(r: Record<string, unknown>): ReservationRow {
  const assignments = (r.assignments as { status: string | null }[] | null) ?? []
  const stays = (r.stays as { status: string | null }[] | null) ?? []
  return {
    id: r.id as number,
    xnid: (r.xnid as string | null) ?? null,
    status: (r.status as string) ?? 'draft',
    marinaId: (r.marina_id as number | null) ?? null,
    dockId: (r.dock_id as number | null) ?? null,
    dockName: (r.dock as { name?: string | null } | null)?.name ?? null,
    boatId: (r.boat_id as number | null) ?? null,
    boatName: (r.boat as { boat_name?: string | null } | null)?.boat_name ?? null,
    slipId: (r.slip_id as number | null) ?? null,
    ratePlanId: (r.rate_plan_id as number | null) ?? null,
    ratePlanName: (r.rate_plan as { name?: string | null } | null)?.name ?? null,
    quoteId: (r.quote_id as number | null) ?? null,
    userId: (r.user_id as string | null) ?? null,
    loa: r.loa == null ? null : Number(r.loa),
    startDate: (r.start_date as string | null) ?? null,
    endDate: (r.end_date as string | null) ?? null,
    days: r.days == null ? null : Number(r.days),
    rate: r.rate == null ? null : Number(r.rate),
    subtotal: Number(r.subtotal ?? 0),
    tax: Number(r.tax ?? 0),
    total: Number(r.total ?? 0),
    billedBy: (r.billed_by as string | null) ?? null,
    assignmentStatus: assignments[0]?.status ?? null,
    stayStatus: stays[0]?.status ?? null,
    createdAt: r.created_at as string,
  }
}

export async function listReservations(params: {
  page?: number
  perPage?: number
  reservationStatus?: string
  assignmentStatus?: string
  dockId?: number
  boatId?: number
  marinaId?: number
  startDate?: string
  endDate?: string
  search?: string
} = {}): Promise<Paginated<ReservationRow>> {
  const page = Math.max(1, params.page ?? 1)
  const perPage = Math.min(100, Math.max(1, params.perPage ?? 20))
  const from = (page - 1) * perPage

  const supabase = await createClient()
  let query = supabase.from('reservations').select(RESERVATION_LIST_COLS, { count: 'exact' })
  if (params.reservationStatus) query = query.in('status', params.reservationStatus.split(','))
  if (params.dockId != null) query = query.eq('dock_id', params.dockId)
  if (params.boatId != null) query = query.eq('boat_id', params.boatId)
  if (params.marinaId != null) query = query.eq('marina_id', params.marinaId)
  if (params.startDate && params.endDate)
    query = query.gte('start_date', params.startDate).lte('start_date', params.endDate)

  const { data, count, error } = await query
    .order('id', { ascending: false })
    .range(from, from + perPage - 1)
  if (error) throw error

  let rows = (data ?? []).map((r) => toReservation(r as Record<string, unknown>))
  // Assignment-status / free-text filters that span an embed are applied here.
  if (params.assignmentStatus) {
    const wanted = params.assignmentStatus.split(',').map((s) => s.trim())
    rows = rows.filter(
      (row) =>
        (wanted.includes('unassigned') && row.assignmentStatus == null) ||
        (row.assignmentStatus != null && wanted.includes(row.assignmentStatus)),
    )
  }
  if (params.search) {
    const q = params.search.toLowerCase()
    rows = rows.filter(
      (row) =>
        String(row.id).includes(q) ||
        row.status.toLowerCase().includes(q) ||
        (row.boatName ?? '').toLowerCase().includes(q) ||
        (row.dockName ?? '').toLowerCase().includes(q),
    )
  }
  return paginate(rows, count ?? rows.length, page, perPage)
}

export interface ReservationDetail extends ReservationRow {
  assignment: { id: number; xnid: string | null; status: string; slipId: number | null; slipName: string | null } | null
  stay: {
    id: number
    xnid: string | null
    status: string
    expectedArrival: string | null
    actualArrival: string | null
    expectedDeparture: string | null
    actualDeparture: string | null
  } | null
  quote: { id: number; xnid: string | null; status: string | null } | null
  contracts: { id: number; xnid: string | null; status: string }[]
  posTransactions: { id: number; xnid: string | null; serviceName: string; amount: number; type: string }[]
}

const RESERVATION_DETAIL_COLS =
  'id, xnid, status, marina_id, dock_id, boat_id, slip_id, rate_plan_id, quote_id, user_id, loa, start_date, end_date, days, rate, subtotal, tax, total, billed_by, created_at, dock:docks(name), boat:boats(boat_name), rate_plan:rate_plans(name), assignments(id, xnid, status, slip_id, slip:slips(name)), stays(id, xnid, status, expected_arrival, actual_arrival, expected_departure, actual_departure), quote:quotes!reservations_quote_id_fkey(id, xnid, status), contracts(id, xnid, status), pos_transactions(id, xnid, service_name, amount, type)'

export async function getReservation(id: number): Promise<ReservationDetail | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('reservations')
    .select(RESERVATION_DETAIL_COLS)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const r = data as Record<string, unknown>
  const base = toReservation(r)

  const aRaw = ((r.assignments as Record<string, unknown>[] | null) ?? [])[0] ?? null
  const sRaw = ((r.stays as Record<string, unknown>[] | null) ?? [])[0] ?? null
  const qRaw = (r.quote as Record<string, unknown> | null) ?? null

  return {
    ...base,
    assignment: aRaw
      ? {
          id: aRaw.id as number,
          xnid: (aRaw.xnid as string | null) ?? null,
          status: (aRaw.status as string) ?? 'unassigned',
          slipId: (aRaw.slip_id as number | null) ?? null,
          slipName: (aRaw.slip as { name?: string | null } | null)?.name ?? null,
        }
      : null,
    stay: sRaw
      ? {
          id: sRaw.id as number,
          xnid: (sRaw.xnid as string | null) ?? null,
          status: (sRaw.status as string) ?? 'expected',
          expectedArrival: (sRaw.expected_arrival as string | null) ?? null,
          actualArrival: (sRaw.actual_arrival as string | null) ?? null,
          expectedDeparture: (sRaw.expected_departure as string | null) ?? null,
          actualDeparture: (sRaw.actual_departure as string | null) ?? null,
        }
      : null,
    quote: qRaw
      ? { id: qRaw.id as number, xnid: (qRaw.xnid as string | null) ?? null, status: (qRaw.status as string | null) ?? null }
      : null,
    contracts: ((r.contracts as Record<string, unknown>[] | null) ?? []).map((c) => ({
      id: c.id as number,
      xnid: (c.xnid as string | null) ?? null,
      status: (c.status as string) ?? 'required',
    })),
    posTransactions: ((r.pos_transactions as Record<string, unknown>[] | null) ?? []).map((t) => ({
      id: t.id as number,
      xnid: (t.xnid as string | null) ?? null,
      serviceName: (t.service_name as string) ?? '',
      amount: Number(t.amount ?? 0),
      type: (t.type as string) ?? 'charge',
    })),
  }
}

// ---------------------------------------------------------------------------
// pickers for the quote calculator
// ---------------------------------------------------------------------------
export async function getPmsPickers(marinaId: number): Promise<{
  docks: { id: number; name: string }[]
  boats: { id: number; name: string; loa: number | null; dockId: number | null }[]
}> {
  const supabase = await createClient()
  const [{ data: docks }, { data: boats }] = await Promise.all([
    supabase.from('docks').select('id, name').eq('marina_id', marinaId).order('name'),
    supabase.from('boats').select('id, boat_name, boat_loa, dock_id').eq('marina_id', marinaId).order('boat_name'),
  ])
  return {
    docks: (docks ?? []).map((d) => ({ id: d.id, name: d.name })),
    boats: (boats ?? []).map((b) => ({
      id: b.id,
      name: b.boat_name,
      loa: b.boat_loa == null ? null : Number(b.boat_loa),
      dockId: b.dock_id,
    })),
  }
}
