import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/database.types'

/**
 * Port of the Laravel `App\Services\PricingService` (+ the plan-resolution
 * helpers that lived in `QuoteController`). Drives the stateless quote
 * calculator, the persisted quote, and the reservation store.
 *
 * Faithful to the old maths:
 *  - `days = start.diffInDays(end)` — whole 24h periods (both inputs are
 *    date-only 'YYYY-MM-DD', so this is a plain calendar-day delta).
 *  - `base_rate` for a `calc_type = 'monthly'` plan is `rate / 30` (rounded to
 *    4 dp); otherwise the plan rate as-is.
 *  - The plan's `condition` (LOA-rule array) only ever produces a *label* in
 *    the old code — `applyRule` returns `baseRate` unchanged in every branch.
 *    The `type` (`percent`|`fixed`) / `value` adjustment was never implemented;
 *    reproduced as-is (recorded in `tech-debt.md`).
 *  - `TAX_RATE = 0.08`, applied `round(subtotal * 0.08, 2)`.
 *  - PHP `round()` is half-away-from-zero — matched here so cent-level results
 *    are identical to the parity oracle.
 */

type Db = SupabaseClient<Database>

export const TAX_RATE = 0.08

/** PHP-style round(): half away from zero, to `dp` decimal places. */
export function phpRound(value: number, dp = 0): number {
  if (!Number.isFinite(value)) return 0
  const factor = 10 ** dp
  const scaled = value * factor
  const r = scaled >= 0 ? Math.floor(scaled + 0.5) : Math.ceil(scaled - 0.5)
  return r / factor
}

export interface LoaCondition {
  loa_operator?: string
  loa_value_1?: number | string
  loa_value_2?: number | string
  [k: string]: unknown
}

export interface RatePlanForPricing {
  id: number
  name: string | null
  calc_type: string | null
  rate: number | string | null
  start_date: string | null
  end_date: string | null
  condition: unknown
}

export interface PricingBreakdown {
  calc_type: string | null
  days: number
  months: number
  base_rate: number
  nightly_total: number
  subtotal: number
  tax_rate: number
  tax: number
  total: number
  rule_applied: string | null
}

/** Whole-day delta between two 'YYYY-MM-DD' (or ISO) date strings. */
export function diffInDays(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate.slice(0, 10)}T00:00:00Z`)
  const end = Date.parse(`${endDate.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(start) || Number.isNaN(end)) return 0
  return Math.floor(Math.abs(end - start) / 86_400_000)
}

function normaliseConditions(raw: unknown): LoaCondition[] {
  if (Array.isArray(raw)) return raw as LoaCondition[]
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? (parsed as LoaCondition[]) : []
    } catch {
      return []
    }
  }
  return []
}

/** Mirrors `PricingService::conditionMatches`. */
export function conditionMatches(cond: LoaCondition, loa: number): boolean {
  if (cond.loa_operator == null || cond.loa_value_1 == null) return false
  const op = cond.loa_operator
  const v1 = Number(cond.loa_value_1)
  const v2 = cond.loa_value_2 != null ? Number(cond.loa_value_2) : null
  switch (op) {
    case '>=':
      return loa >= v1
    case '<=':
      return loa <= v1
    case '>':
      return loa > v1
    case '<':
      return loa < v1
    case '=':
      return loa === v1
    case 'between':
      return v2 !== null && loa >= v1 && loa <= v2
    default:
      return false
  }
}

/** Mirrors `PricingService::applyRule` — returns `[rate, ruleLabel]`. */
function applyRule(
  plan: RatePlanForPricing,
  baseRate: number,
  loa: number,
): [number, string | null] {
  const conditions = normaliseConditions(plan.condition)
  if (conditions.length === 0) return [baseRate, null]
  for (const cond of conditions) {
    if (conditionMatches(cond, loa)) {
      const label = `${cond.loa_operator ?? ''} ${cond.loa_value_1 ?? ''}`.trim()
      return [baseRate, label]
    }
  }
  return [baseRate, null]
}

/** Mirrors `PricingService::calculate`. */
export function calculatePricing(
  plan: RatePlanForPricing,
  loa: number,
  startDate: string,
  endDate: string,
): PricingBreakdown {
  const days = diffInDays(startDate, endDate)
  const months = phpRound(days / 30, 2)
  const planRate = Number(plan.rate ?? 0)

  const baseRate =
    plan.calc_type === 'monthly' ? phpRound(planRate / 30, 4) : planRate

  const [rateToUse, appliedRule] = applyRule(plan, baseRate, loa)

  const subtotal = phpRound(rateToUse * days, 2)
  const tax = phpRound(subtotal * TAX_RATE, 2)
  const total = phpRound(subtotal + tax, 2)

  return {
    calc_type: plan.calc_type,
    days,
    months,
    base_rate: phpRound(planRate, 2),
    nightly_total: phpRound(rateToUse, 2),
    subtotal,
    tax_rate: TAX_RATE,
    tax,
    total,
    rule_applied: appliedRule,
  }
}

/**
 * Apply an optional discount + surcharge on top of a base breakdown, matching
 * `QuoteController::store` / `::generate`:
 *  - `percent` discount → `round(subtotal * pct/100, 2)`, `fixed` → the amount
 *  - `finalSubtotal = subtotal - discountAmt + surchargeAmt`
 *  - tax + total are recomputed on the final subtotal at 8%.
 */
export function applyAdjustments(
  base: PricingBreakdown,
  opts: { discount?: number | null; discountType?: 'percent' | 'fixed' | null; surcharge?: number | null },
): {
  discountAmount: number
  surchargeAmount: number
  finalSubtotal: number
  finalTax: number
  finalTotal: number
} {
  const discount = Number(opts.discount ?? 0)
  const discountType = opts.discountType ?? null
  let discountAmount = 0
  if (discount > 0 && discountType) {
    discountAmount =
      discountType === 'percent' ? phpRound(base.subtotal * (discount / 100), 2) : discount
  }
  const surchargeAmount = Number(opts.surcharge ?? 0)
  const finalSubtotal = phpRound(base.subtotal - discountAmount + surchargeAmount, 2)
  const finalTax = phpRound(finalSubtotal * TAX_RATE, 2)
  const finalTotal = phpRound(finalSubtotal + finalTax, 2)
  return { discountAmount, surchargeAmount, finalSubtotal, finalTax, finalTotal }
}

const RATE_PLAN_PRICING_COLS = 'id, name, calc_type, rate, start_date, end_date, condition'

/**
 * Mirrors `QuoteController::resolvePlan` — the first rate plan whose active
 * window covers the date range AND which has an LOA condition matching the
 * boat. `marinaId` scopes the search (the old query was global; the new one
 * stays within the marina the dock belongs to).
 */
export async function resolvePlan(
  db: Db,
  loa: number,
  startDate: string,
  endDate: string,
  marinaId?: number,
): Promise<RatePlanForPricing | null> {
  let query = db.from('rate_plans').select(RATE_PLAN_PRICING_COLS).order('start_date', {
    ascending: true,
    nullsFirst: true,
  })
  if (marinaId != null) query = query.eq('marina_id', marinaId)
  const { data, error } = await query
  if (error) throw error

  const start = startDate.slice(0, 10)
  const end = endDate.slice(0, 10)

  for (const plan of (data ?? []) as RatePlanForPricing[]) {
    const windowOk =
      plan.start_date == null ||
      (plan.start_date.slice(0, 10) <= start &&
        (plan.end_date == null || plan.end_date.slice(0, 10) >= end))
    if (!windowOk) continue
    const conditions = normaliseConditions(plan.condition)
    if (conditions.some((c) => conditionMatches(c, loa))) return plan
  }
  return null
}

/**
 * Mirrors `PricingService::availableSlipCount` — active slips on the dock whose
 * LOA range admits the boat and which have no overlapping active reservation.
 * PostgREST can't express the three-clause overlap in one `.or()`, so the
 * overlap filter is applied in JS (identical semantics; tables are small).
 */
export async function availableSlipCount(
  db: Db,
  dockId: number,
  boatLoa: number,
  startDate: string,
  endDate: string,
): Promise<number> {
  const { data: slips, error } = await db
    .from('slips')
    .select('id, min_loa, max_loa')
    .eq('dock_id', dockId)
    .eq('is_active', true)
  if (error) throw error

  const fitting = (slips ?? []).filter(
    (s) =>
      (s.min_loa == null || s.min_loa <= boatLoa) &&
      (s.max_loa == null || s.max_loa >= boatLoa),
  )
  if (fitting.length === 0) return 0

  const slipIds = fitting.map((s) => s.id)
  const { data: reservations } = await db
    .from('reservations')
    .select('slip_id, start_date, end_date')
    .in('slip_id', slipIds)
    .in('status', ['confirmed', 'pending_customer', 'hold', 'waitlisted'])

  const start = startDate.slice(0, 10)
  const end = endDate.slice(0, 10)
  const blocked = new Set<number>()
  for (const r of reservations ?? []) {
    if (r.slip_id == null || r.start_date == null || r.end_date == null) continue
    const rs = r.start_date.slice(0, 10)
    const re = r.end_date.slice(0, 10)
    const overlaps =
      (rs >= start && rs <= end) ||
      (re >= start && re <= end) ||
      (rs <= start && re >= end)
    if (overlaps) blocked.add(r.slip_id)
  }
  return fitting.filter((s) => !blocked.has(s.id)).length
}
