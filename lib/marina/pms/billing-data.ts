import 'server-only'

import { createClient } from '@/utils/supabase/server'

import type { Paginated } from './data'

/**
 * Marina PMS billing reads — POS transactions, invoices, ledgers, meters, and
 * the folio (`PosTransactionController@folio`). Ports the read side of
 * `PosTransactionController` / `InvoiceController` (`api-inventory.md` §4.9).
 * RLS applies the `marina` scope.
 */

function paginate<T>(rows: T[], total: number, page: number, perPage: number): Paginated<T> {
  return { rows, total, page, perPage, totalPages: Math.max(1, Math.ceil(total / perPage)) }
}

// ---------------------------------------------------------------------------
// POS transactions
// ---------------------------------------------------------------------------
export interface PosTxnRow {
  id: number
  xnid: string | null
  marinaId: number | null
  stayId: number | null
  reservationId: number | null
  assignmentId: number | null
  contractId: number | null
  boatId: number | null
  boatName: string | null
  slipId: number | null
  serviceCategory: string | null
  serviceName: string
  amount: number
  type: string
  quantity: number
  unitPrice: number | null
  notes: string | null
  createdBy: string | null
  createdAt: string
}

const POS_COLS =
  'id, xnid, marina_id, stay_id, reservation_id, assignment_id, contract_id, boat_id, slip_id, service_category, service_name, amount, type, quantity, unit_price, notes, created_by, created_at, boat:boats(boat_name)'

function toPos(r: Record<string, unknown>): PosTxnRow {
  return {
    id: r.id as number,
    xnid: (r.xnid as string | null) ?? null,
    marinaId: (r.marina_id as number | null) ?? null,
    stayId: (r.stay_id as number | null) ?? null,
    reservationId: (r.reservation_id as number | null) ?? null,
    assignmentId: (r.assignment_id as number | null) ?? null,
    contractId: (r.contract_id as number | null) ?? null,
    boatId: (r.boat_id as number | null) ?? null,
    boatName: (r.boat as { boat_name?: string | null } | null)?.boat_name ?? null,
    slipId: (r.slip_id as number | null) ?? null,
    serviceCategory: (r.service_category as string | null) ?? null,
    serviceName: (r.service_name as string) ?? '',
    amount: Number(r.amount ?? 0),
    type: (r.type as string) ?? 'charge',
    quantity: Number(r.quantity ?? 1),
    unitPrice: r.unit_price == null ? null : Number(r.unit_price),
    notes: (r.notes as string | null) ?? null,
    createdBy: (r.created_by as string | null) ?? null,
    createdAt: r.created_at as string,
  }
}

export async function listPosTransactions(params: {
  page?: number
  perPage?: number
  marinaId?: number
  boatId?: number
  reservationId?: number
  stayId?: number
  serviceCategory?: string
} = {}): Promise<Paginated<PosTxnRow>> {
  const page = Math.max(1, params.page ?? 1)
  const perPage = Math.min(100, Math.max(1, params.perPage ?? 20))
  const from = (page - 1) * perPage

  const supabase = await createClient()
  let query = supabase.from('pos_transactions').select(POS_COLS, { count: 'exact' })
  if (params.marinaId != null) query = query.eq('marina_id', params.marinaId)
  if (params.boatId != null) query = query.eq('boat_id', params.boatId)
  if (params.reservationId != null) query = query.eq('reservation_id', params.reservationId)
  if (params.stayId != null) query = query.eq('stay_id', params.stayId)
  if (params.serviceCategory) query = query.eq('service_category', params.serviceCategory)

  const { data, count, error } = await query
    .order('id', { ascending: false })
    .range(from, from + perPage - 1)
  if (error) throw error
  return paginate((data ?? []).map((r) => toPos(r as Record<string, unknown>)), count ?? 0, page, perPage)
}

export interface Folio {
  stay: { id: number; xnid: string | null; status: string }
  reservation: { id: number; xnid: string | null; startDate: string | null; endDate: string | null } | null
  boatName: string | null
  slipName: string | null
  contractAmount: number
  posCharges: number
  posCredits: number
  totalPos: number
  grandTotal: number
  transactions: PosTxnRow[]
}

/** `PosTransactionController@folio($stay)`. */
export async function getFolio(stayId: number): Promise<Folio | null> {
  const supabase = await createClient()
  const { data: stay } = await supabase
    .from('stays')
    .select(
      'id, xnid, status, reservation_id, boat:boats(boat_name), reservation:reservations(id, xnid, start_date, end_date, assignments(slip:slips(name)), contracts(monthly_rate))',
    )
    .eq('id', stayId)
    .maybeSingle()
  if (!stay) return null

  const { rows: transactions } = await listPosTransactions({ stayId, perPage: 100 })
  const res = stay.reservation as Record<string, unknown> | null
  const contracts = ((res?.contracts as { monthly_rate: number | string }[] | null) ?? [])
  const contractAmount = contracts.reduce((s, c) => s + Number(c.monthly_rate ?? 0), 0)
  const posCharges = transactions.filter((t) => t.type === 'charge').reduce((s, t) => s + t.amount, 0)
  const posCredits = transactions.filter((t) => t.type === 'credit').reduce((s, t) => s + t.amount, 0)
  const totalPos = posCharges - posCredits
  const slipName =
    (((res?.assignments as { slip: { name: string | null } | null }[] | null) ?? [])[0]?.slip?.name) ?? null

  return {
    stay: { id: stay.id, xnid: stay.xnid, status: stay.status },
    reservation: res
      ? {
          id: res.id as number,
          xnid: (res.xnid as string | null) ?? null,
          startDate: (res.start_date as string | null) ?? null,
          endDate: (res.end_date as string | null) ?? null,
        }
      : null,
    boatName: (stay.boat as { boat_name?: string | null } | null)?.boat_name ?? null,
    slipName,
    contractAmount,
    posCharges,
    posCredits,
    totalPos,
    grandTotal: contractAmount + totalPos,
    transactions,
  }
}

// ---------------------------------------------------------------------------
// invoices
// ---------------------------------------------------------------------------
export interface InvoiceRow {
  id: number
  xnid: string | null
  marinaId: number | null
  billableType: string
  billableId: number
  contractId: number | null
  reservationId: number | null
  stayId: number | null
  amount: number
  status: string
  paidAt: string | null
  createdAt: string
}

const INVOICE_COLS =
  'id, xnid, marina_id, billable_type, billable_id, contract_id, reservation_id, stay_id, amount, status, paid_at, created_at'

function toInvoice(r: Record<string, unknown>): InvoiceRow {
  return {
    id: r.id as number,
    xnid: (r.xnid as string | null) ?? null,
    marinaId: (r.marina_id as number | null) ?? null,
    billableType: (r.billable_type as string) ?? '',
    billableId: r.billable_id as number,
    contractId: (r.contract_id as number | null) ?? null,
    reservationId: (r.reservation_id as number | null) ?? null,
    stayId: (r.stay_id as number | null) ?? null,
    amount: Number(r.amount ?? 0),
    status: (r.status as string) ?? 'unpaid',
    paidAt: (r.paid_at as string | null) ?? null,
    createdAt: r.created_at as string,
  }
}

export async function listInvoices(params: {
  page?: number
  perPage?: number
  marinaId?: number
  status?: string
  contractId?: number
  reservationId?: number
} = {}): Promise<Paginated<InvoiceRow>> {
  const page = Math.max(1, params.page ?? 1)
  const perPage = Math.min(100, Math.max(1, params.perPage ?? 20))
  const from = (page - 1) * perPage

  const supabase = await createClient()
  let query = supabase.from('invoices').select(INVOICE_COLS, { count: 'exact' })
  if (params.marinaId != null) query = query.eq('marina_id', params.marinaId)
  if (params.status)
    query = query.in(
      'status',
      params.status.split(',') as ('unpaid' | 'paid' | 'void' | 'partially_paid')[],
    )
  if (params.contractId != null) query = query.eq('contract_id', params.contractId)
  if (params.reservationId != null) query = query.eq('reservation_id', params.reservationId)

  const { data, count, error } = await query
    .order('id', { ascending: false })
    .range(from, from + perPage - 1)
  if (error) throw error
  return paginate((data ?? []).map((r) => toInvoice(r as Record<string, unknown>)), count ?? 0, page, perPage)
}

export async function getInvoice(id: number): Promise<
  | (InvoiceRow & { ledgers: { id: number; debit: number; credit: number; memo: string | null; createdAt: string }[] })
  | null
> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('invoices')
    .select(
      'id, xnid, marina_id, billable_type, billable_id, contract_id, reservation_id, stay_id, amount, status, paid_at, created_at, ledgers(id, debit, credit, memo, created_at)',
    )
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const r = data as Record<string, unknown>
  return {
    ...toInvoice(r),
    ledgers: ((r.ledgers as Record<string, unknown>[] | null) ?? []).map((l) => ({
      id: l.id as number,
      debit: Number(l.debit ?? 0),
      credit: Number(l.credit ?? 0),
      memo: (l.memo as string | null) ?? null,
      createdAt: l.created_at as string,
    })),
  }
}

/** `InvoiceController@arAging` — aging buckets over every invoice. */
export async function getArAging(marinaId?: number): Promise<{
  '0-30': number
  '31-60': number
  '61-90': number
  '90+': number
}> {
  const supabase = await createClient()
  let query = supabase.from('invoices').select('amount, status, created_at')
  if (marinaId != null) query = query.eq('marina_id', marinaId)
  const { data, error } = await query
  if (error) throw error

  const buckets = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 }
  const now = Date.now()
  for (const inv of data ?? []) {
    const days = Math.floor((now - new Date(inv.created_at as string).getTime()) / 86_400_000)
    const amt = Number(inv.amount ?? 0)
    if (days <= 30) buckets['0-30'] += amt
    else if (days <= 60) buckets['31-60'] += amt
    else if (days <= 90) buckets['61-90'] += amt
    else buckets['90+'] += amt
  }
  return buckets
}

// ---------------------------------------------------------------------------
// ledgers + meters
// ---------------------------------------------------------------------------
export interface LedgerRow {
  id: number
  xnid: string | null
  marinaId: number | null
  invoiceId: number | null
  debit: number
  credit: number
  memo: string | null
  createdAt: string
}

export async function listLedgers(marinaId: number): Promise<LedgerRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ledgers')
    .select('id, xnid, marina_id, invoice_id, debit, credit, memo, created_at')
    .eq('marina_id', marinaId)
    .order('id', { ascending: false })
  if (error) throw error
  return (data ?? []).map((l) => ({
    id: l.id,
    xnid: l.xnid,
    marinaId: l.marina_id,
    invoiceId: l.invoice_id,
    debit: Number(l.debit ?? 0),
    credit: Number(l.credit ?? 0),
    memo: l.memo,
    createdAt: l.created_at,
  }))
}

export interface MeterRow {
  id: number
  xnid: string | null
  marinaId: number | null
  slipId: number
  slipName: string | null
  reading: number
  createdAt: string
}

export async function listMeters(marinaId: number, slipId?: number): Promise<MeterRow[]> {
  const supabase = await createClient()
  let query = supabase
    .from('meters')
    .select('id, xnid, marina_id, slip_id, reading, created_at, slip:slips(name)')
    .eq('marina_id', marinaId)
  if (slipId != null) query = query.eq('slip_id', slipId)
  const { data, error } = await query.order('id', { ascending: false })
  if (error) throw error
  return (data ?? []).map((m) => ({
    id: m.id as number,
    xnid: (m.xnid as string | null) ?? null,
    marinaId: (m.marina_id as number | null) ?? null,
    slipId: m.slip_id as number,
    slipName: (m.slip as { name?: string | null } | null)?.name ?? null,
    reading: Number(m.reading ?? 0),
    createdAt: m.created_at as string,
  }))
}
