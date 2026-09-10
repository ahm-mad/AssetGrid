import 'server-only'

import { createClient } from '@/utils/supabase/server'

import type { Paginated } from './data'

/**
 * Marina PMS contract reads — ports `ContractController@index` / `@show` /
 * `@amendments` (`api-inventory.md` §4.9).
 */

export interface ContractRow {
  id: number
  xnid: string | null
  status: string
  marinaId: number | null
  slipId: number
  slipName: string | null
  boatId: number
  boatName: string | null
  ratePlanId: number
  reservationId: number | null
  userId: string | null
  customerName: string | null
  contractType: string | null
  monthlyRate: number
  startDate: string | null
  endDate: string | null
  signedAt: string | null
  pdfUrl: string | null
  originalContractId: number | null
  createdAt: string
}

export interface ContractAmendmentRow {
  id: number
  xnid: string | null
  contractId: number
  amendmentType: string
  description: string | null
  status: string
  originalAmount: number | null
  newAmount: number | null
  originalStartDate: string | null
  originalEndDate: string | null
  newStartDate: string | null
  newEndDate: string | null
  originalSlipId: number | null
  newSlipId: number | null
  signedAt: string | null
  appliedAt: string | null
  createdAt: string
}

export interface ContractDetail extends ContractRow {
  structuredTerms: Record<string, string | null> | null
  hasSignature: boolean
  amendments: ContractAmendmentRow[]
}

const CONTRACT_COLS =
  'id, xnid, status, marina_id, slip_id, boat_id, rate_plan_id, reservation_id, user_id, contract_type, monthly_rate, start_date, end_date, signed_at, pdf_url, original_contract_id, created_at, slip:slips(name), boat:boats(boat_name), customer:profiles(first_name, last_name)'

function toContract(r: Record<string, unknown>): ContractRow {
  const cust = r.customer as { first_name?: string | null; last_name?: string | null } | null
  return {
    id: r.id as number,
    xnid: (r.xnid as string | null) ?? null,
    status: (r.status as string) ?? 'required',
    marinaId: (r.marina_id as number | null) ?? null,
    slipId: r.slip_id as number,
    slipName: (r.slip as { name?: string | null } | null)?.name ?? null,
    boatId: r.boat_id as number,
    boatName: (r.boat as { boat_name?: string | null } | null)?.boat_name ?? null,
    ratePlanId: r.rate_plan_id as number,
    reservationId: (r.reservation_id as number | null) ?? null,
    userId: (r.user_id as string | null) ?? null,
    customerName: cust
      ? [cust.first_name, cust.last_name].filter(Boolean).join(' ') || null
      : null,
    contractType: (r.contract_type as string | null) ?? null,
    monthlyRate: Number(r.monthly_rate ?? 0),
    startDate: (r.start_date as string | null) ?? null,
    endDate: (r.end_date as string | null) ?? null,
    signedAt: (r.signed_at as string | null) ?? null,
    pdfUrl: (r.pdf_url as string | null) ?? null,
    originalContractId: (r.original_contract_id as number | null) ?? null,
    createdAt: r.created_at as string,
  }
}

function toAmendment(r: Record<string, unknown>): ContractAmendmentRow {
  return {
    id: r.id as number,
    xnid: (r.xnid as string | null) ?? null,
    contractId: r.contract_id as number,
    amendmentType: (r.amendment_type as string) ?? '',
    description: (r.description as string | null) ?? null,
    status: (r.status as string) ?? 'draft',
    originalAmount: r.original_amount == null ? null : Number(r.original_amount),
    newAmount: r.new_amount == null ? null : Number(r.new_amount),
    originalStartDate: (r.original_start_date as string | null) ?? null,
    originalEndDate: (r.original_end_date as string | null) ?? null,
    newStartDate: (r.new_start_date as string | null) ?? null,
    newEndDate: (r.new_end_date as string | null) ?? null,
    originalSlipId: (r.original_slip_id as number | null) ?? null,
    newSlipId: (r.new_slip_id as number | null) ?? null,
    signedAt: (r.signed_at as string | null) ?? null,
    appliedAt: (r.applied_at as string | null) ?? null,
    createdAt: r.created_at as string,
  }
}

export async function listContracts(params: {
  page?: number
  perPage?: number
  status?: string
  marinaId?: number
  boatId?: number
  reservationId?: number
  search?: string
} = {}): Promise<Paginated<ContractRow>> {
  const page = Math.max(1, params.page ?? 1)
  const perPage = Math.min(100, Math.max(1, params.perPage ?? 20))
  const from = (page - 1) * perPage

  const supabase = await createClient()
  let query = supabase.from('contracts').select(CONTRACT_COLS, { count: 'exact' })
  if (params.status) query = query.in('status', params.status.split(','))
  if (params.marinaId != null) query = query.eq('marina_id', params.marinaId)
  if (params.boatId != null) query = query.eq('boat_id', params.boatId)
  if (params.reservationId != null) query = query.eq('reservation_id', params.reservationId)

  const { data, count, error } = await query
    .order('id', { ascending: false })
    .range(from, from + perPage - 1)
  if (error) throw error

  let rows = (data ?? []).map((r) => toContract(r as Record<string, unknown>))
  if (params.search) {
    const q = params.search.toLowerCase()
    rows = rows.filter(
      (r) =>
        (r.xnid ?? '').toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q) ||
        (r.boatName ?? '').toLowerCase().includes(q) ||
        (r.customerName ?? '').toLowerCase().includes(q),
    )
  }
  return {
    rows,
    total: count ?? rows.length,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil((count ?? rows.length) / perPage)),
  }
}

export async function getContract(id: number): Promise<ContractDetail | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('contracts')
    .select(
      'id, xnid, status, marina_id, slip_id, boat_id, rate_plan_id, reservation_id, user_id, contract_type, monthly_rate, start_date, end_date, signed_at, pdf_url, original_contract_id, created_at, structured_terms, signature, slip:slips(name), boat:boats(boat_name), customer:profiles(first_name, last_name), contract_amendments(id, xnid, contract_id, amendment_type, description, status, original_amount, new_amount, original_start_date, original_end_date, new_start_date, new_end_date, original_slip_id, new_slip_id, signed_at, applied_at, created_at)',
    )
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const r = data as Record<string, unknown>
  return {
    ...toContract(r),
    structuredTerms: (r.structured_terms as Record<string, string | null> | null) ?? null,
    hasSignature: r.signature != null,
    amendments: ((r.contract_amendments as Record<string, unknown>[] | null) ?? [])
      .map(toAmendment)
      .sort((a, b) => b.id - a.id),
  }
}
