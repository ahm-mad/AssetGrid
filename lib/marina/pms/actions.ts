'use server'

import { randomUUID } from 'node:crypto'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createClient } from '@/utils/supabase/server'
import { requirePermission } from '@/lib/auth/guards'
import {
  applyAdjustments,
  availableSlipCount,
  calculatePricing,
  diffInDays,
  phpRound,
  resolvePlan,
  type PricingBreakdown,
  type RatePlanForPricing,
} from '@/lib/marina/pricing'

/**
 * Marina PMS mutations — ports the write side of `RatePlanController`,
 * `QuoteController` (`calculate` / `generate` / `store`), and
 * `ReservationController` (`store` / `confirm` / `update` / `destroy` /
 * `toggleAssignment` + the reconstructed `findAvailableSlip`).
 *
 * Perm: `marina,{create|update|delete}`; the `marina` data scope is enforced
 * by RLS (the write policies were tightened to check scope in
 * `20260911001312_marina_pms_app.sql`).
 *
 * Contracts get a bare row here (status `required`); their PDF render, e-sign
 * token flow, `send`, amendments and billing are slice 8b.
 */

export interface PmsResult<T = undefined> {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string[]>
  data?: T
}

const RATE_PLAN_PRICING_COLS = 'id, name, calc_type, rate, start_date, end_date, condition'

// ===========================================================================
// rate plans  (RatePlanController)
// ===========================================================================
const conditionSchema = z
  .object({
    loa_operator: z.enum(['>=', '<=', '>', '<', '=', 'between']),
    loa_value_1: z.coerce.number().min(1),
    loa_value_2: z.coerce.number().min(1).nullable().optional(),
  })
  .refine((c) => c.loa_operator !== 'between' || (c.loa_value_2 != null && c.loa_value_2 > c.loa_value_1), {
    message: "loa_value_2 must be present and greater than loa_value_1 for 'between'",
    path: ['loa_value_2'],
  })

const ratePlanSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  marina_id: z.coerce.number().int().positive(),
  name: z.string().trim().min(1).max(191),
  calc_type: z.string().trim().min(1).max(191),
  rate: z.coerce.number().nonnegative(),
  start_date: z.string().trim().min(1).nullable().optional(),
  end_date: z.string().trim().min(1).nullable().optional(),
  type: z.enum(['percent', 'fixed']).nullable().optional(),
  loa_unit: z.string().trim().min(1).max(191),
  value: z.coerce.number().nullable().optional(),
  condition: z.array(conditionSchema).min(1),
})

export async function saveRatePlan(input: unknown): Promise<PmsResult<{ id: number }>> {
  const hasId = !!(input && (input as { id?: unknown }).id)
  await requirePermission('marina', hasId ? 'update' : 'create')
  const parsed = ratePlanSchema.safeParse(input)
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors }
  const v = parsed.data
  const supabase = await createClient()

  const row = {
    marina_id: v.marina_id,
    name: v.name,
    calc_type: v.calc_type,
    rate: v.rate,
    start_date: v.start_date || null,
    end_date: v.end_date || null,
    type: v.type ?? null,
    loa_unit: v.loa_unit,
    value: v.value ?? null,
    condition: v.condition,
  }

  if (v.id) {
    const { error } = await supabase.from('rate_plans').update(row).eq('id', v.id)
    if (error) return { ok: false, error: 'Could not update the rate plan (name already used?).' }
    revalidatePath(`/app/marina/${v.marina_id}/pms`)
    return { ok: true, data: { id: v.id } }
  }
  const { data, error } = await supabase.from('rate_plans').insert(row).select('id').single()
  if (error || !data) return { ok: false, error: 'Could not create the rate plan (name already used?).' }
  revalidatePath(`/app/marina/${v.marina_id}/pms`)
  return { ok: true, data: { id: data.id } }
}

export async function deleteRatePlan(id: number, marinaId: number): Promise<PmsResult> {
  await requirePermission('marina', 'delete')
  const supabase = await createClient()

  const [{ count: resCount }, { count: conCount }] = await Promise.all([
    supabase
      .from('reservations')
      .select('id', { count: 'exact', head: true })
      .eq('rate_plan_id', id)
      .not('status', 'in', '("cancelled","expired","completed")'),
    supabase
      .from('contracts')
      .select('id', { count: 'exact', head: true })
      .eq('rate_plan_id', id)
      .not('status', 'in', '("expired","cancelled")'),
  ])
  if ((resCount ?? 0) > 0)
    return { ok: false, error: `Cannot delete — ${resCount} active reservation(s) use this plan.` }
  if ((conCount ?? 0) > 0)
    return { ok: false, error: `Cannot delete — ${conCount} active contract(s) use this plan.` }

  const { error } = await supabase.from('rate_plans').delete().eq('id', id)
  if (error) return { ok: false, error: 'Could not delete the rate plan.' }
  revalidatePath(`/app/marina/${marinaId}/pms`)
  return { ok: true }
}

// ===========================================================================
// quote pricing  (QuoteController@calculate / @generate / @store)
// ===========================================================================
const quoteInputSchema = z.object({
  dock_id: z.coerce.number().int().positive(),
  boat_id: z.coerce.number().int().positive(),
  rate_plan_id: z.coerce.number().int().positive().nullable().optional(),
  start_date: z.string().trim().min(1),
  end_date: z.string().trim().min(1),
  loa: z.coerce.number().positive().nullable().optional(),
  slip_id: z.coerce.number().int().positive().nullable().optional(),
  discount: z.coerce.number().nonnegative().nullable().optional(),
  discount_type: z.enum(['percent', 'fixed']).nullable().optional(),
  surcharge: z.coerce.number().nonnegative().nullable().optional(),
})

type QuoteInput = z.infer<typeof quoteInputSchema>

interface ResolvedContext {
  marinaId: number
  loa: number
  plan: RatePlanForPricing & { name: string | null }
  autoResolved: boolean
}

/** Shared front half of calculate / generate / store — resolve boat LOA + plan. */
async function resolveQuoteContext(
  v: QuoteInput,
  opts: { requirePlanId?: boolean; alwaysAutoResolve?: boolean } = {},
): Promise<{ ctx?: ResolvedContext; error?: string }> {
  const supabase = await createClient()

  const [{ data: dock }, { data: boat }] = await Promise.all([
    supabase.from('docks').select('id, marina_id').eq('id', v.dock_id).maybeSingle(),
    supabase.from('boats').select('id, boat_loa, marina_id').eq('id', v.boat_id).maybeSingle(),
  ])
  if (!dock) return { error: 'Dock not found.' }
  if (!boat) return { error: 'Boat not found.' }
  const marinaId = dock.marina_id as number

  const loa = v.loa != null && v.loa > 0 ? Number(v.loa) : Number(boat.boat_loa ?? 0)
  if (!loa || loa <= 0)
    return { error: 'LOA is required. Boat has no LOA on record — please provide it manually.' }

  let plan: (RatePlanForPricing & { name: string | null }) | null = null
  let autoResolved = false

  if (!opts.alwaysAutoResolve && v.rate_plan_id) {
    const { data } = await supabase
      .from('rate_plans')
      .select(`${RATE_PLAN_PRICING_COLS}, marina_id`)
      .eq('id', v.rate_plan_id)
      .maybeSingle()
    if (!data) return { error: 'Rate plan not found.' }
    plan = data as unknown as RatePlanForPricing & { name: string | null }
    // dates must fit the plan's active window when the plan is chosen explicitly
    if (plan.start_date && plan.end_date) {
      if (
        v.start_date.slice(0, 10) < plan.start_date.slice(0, 10) ||
        v.end_date.slice(0, 10) > plan.end_date.slice(0, 10)
      ) {
        return { error: 'Reservation dates fall outside the rate plan active period.' }
      }
    }
  } else {
    if (opts.requirePlanId) return { error: 'A rate plan is required.' }
    const resolved = await resolvePlan(supabase, loa, v.start_date, v.end_date, marinaId)
    if (!resolved) return { error: 'No active rate plan found for this boat size and date range.' }
    const { data } = await supabase
      .from('rate_plans')
      .select(`${RATE_PLAN_PRICING_COLS}, name`)
      .eq('id', resolved.id)
      .maybeSingle()
    plan = (data as unknown as RatePlanForPricing & { name: string | null }) ?? { ...resolved, name: null }
    autoResolved = true
  }

  return { ctx: { marinaId, loa, plan: plan!, autoResolved } }
}

export interface QuoteCalculation {
  marinaId: number
  loa: number
  ratePlan: { id: number; name: string | null; calcType: string | null; autoResolved: boolean }
  pricing: PricingBreakdown & {
    discountAmount?: number
    surchargeAmount?: number
    finalSubtotal?: number
    finalTax?: number
    finalTotal?: number
  }
  availableSlips: number
  hasAvailability: boolean
}

/** `QuoteController@calculate` — stateless preview, no write. */
export async function calculateQuote(input: unknown): Promise<PmsResult<QuoteCalculation>> {
  await requirePermission('marina', 'create')
  const parsed = quoteInputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors }
  const v = parsed.data
  if (v.end_date.slice(0, 10) <= v.start_date.slice(0, 10))
    return { ok: false, error: 'End date must be after the start date.' }

  const { ctx, error } = await resolveQuoteContext(v)
  if (!ctx) return { ok: false, error }

  const supabase = await createClient()
  const pricing = calculatePricing(ctx.plan, ctx.loa, v.start_date, v.end_date)
  const adj = applyAdjustments(pricing, {
    discount: v.discount,
    discountType: v.discount_type ?? null,
    surcharge: v.surcharge,
  })
  const slips = await availableSlipCount(supabase, v.dock_id, ctx.loa, v.start_date, v.end_date)

  return {
    ok: true,
    data: {
      marinaId: ctx.marinaId,
      loa: ctx.loa,
      ratePlan: {
        id: ctx.plan.id,
        name: ctx.plan.name,
        calcType: ctx.plan.calc_type,
        autoResolved: ctx.autoResolved,
      },
      pricing: {
        ...pricing,
        discountAmount: adj.discountAmount,
        surchargeAmount: adj.surchargeAmount,
        finalSubtotal: adj.finalSubtotal,
        finalTax: adj.finalTax,
        finalTotal: adj.finalTotal,
      },
      availableSlips: slips,
      hasAvailability: slips > 0,
    },
  }
}

export interface GeneratedQuotePayload {
  reservationPayload: { dockId: number; boatId: number; slipId: number | null; marinaId: number }
  quotePayload: {
    ratePlanId: number
    loa: number
    startDate: string
    endDate: string
    rate: number
    subtotal: number
    discount: number
    surcharge: number
    tax: number
    total: number
  }
  pricing: QuoteCalculation['pricing']
  availableSlips: number
}

/** `QuoteController@generate` — transient payload consumed by `createReservation`. */
export async function generateQuote(input: unknown): Promise<PmsResult<GeneratedQuotePayload>> {
  await requirePermission('marina', 'create')
  const parsed = quoteInputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors }
  const v = parsed.data
  if (v.end_date.slice(0, 10) <= v.start_date.slice(0, 10))
    return { ok: false, error: 'End date must be after the start date.' }

  const { ctx, error } = await resolveQuoteContext(v, { alwaysAutoResolve: true })
  if (!ctx) return { ok: false, error }

  const supabase = await createClient()
  const pricing = calculatePricing(ctx.plan, ctx.loa, v.start_date, v.end_date)
  const adj = applyAdjustments(pricing, {
    discount: v.discount,
    discountType: v.discount_type ?? null,
    surcharge: v.surcharge,
  })
  const slips = await availableSlipCount(supabase, v.dock_id, ctx.loa, v.start_date, v.end_date)

  return {
    ok: true,
    data: {
      reservationPayload: {
        dockId: v.dock_id,
        boatId: v.boat_id,
        slipId: v.slip_id ?? null,
        marinaId: ctx.marinaId,
      },
      quotePayload: {
        ratePlanId: ctx.plan.id,
        loa: ctx.loa,
        startDate: v.start_date.slice(0, 10),
        endDate: v.end_date.slice(0, 10),
        rate: pricing.nightly_total,
        subtotal: pricing.subtotal,
        discount: adj.discountAmount,
        surcharge: adj.surchargeAmount,
        tax: adj.finalTax,
        total: adj.finalTotal,
      },
      pricing: {
        ...pricing,
        discountAmount: adj.discountAmount,
        surchargeAmount: adj.surchargeAmount,
        finalSubtotal: adj.finalSubtotal,
        finalTax: adj.finalTax,
        finalTotal: adj.finalTotal,
      },
      availableSlips: slips,
    },
  }
}

const saveQuoteSchema = quoteInputSchema.extend({
  rate_plan_id: z.coerce.number().int().positive(),
  loa: z.coerce.number().int().min(10),
})

/** `QuoteController@store` — persist a quote with a 15-minute hold. */
export async function saveQuote(input: unknown): Promise<PmsResult<{ id: number; holdExpiresAt: string }>> {
  await requirePermission('marina', 'create')
  const parsed = saveQuoteSchema.safeParse(input)
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors }
  const v = parsed.data
  if (v.end_date.slice(0, 10) <= v.start_date.slice(0, 10))
    return { ok: false, error: 'End date must be after the start date.' }

  const supabase = await createClient()
  const { data: plan } = await supabase
    .from('rate_plans')
    .select(`${RATE_PLAN_PRICING_COLS}, marina_id`)
    .eq('id', v.rate_plan_id)
    .maybeSingle()
  if (!plan) return { ok: false, error: 'Rate plan not found.' }
  if (
    !plan.start_date ||
    !plan.end_date ||
    v.start_date.slice(0, 10) < plan.start_date.slice(0, 10) ||
    v.end_date.slice(0, 10) > plan.end_date.slice(0, 10)
  ) {
    return { ok: false, error: 'Reservation dates fall outside the rate plan active period.' }
  }

  const pricing = calculatePricing(plan as unknown as RatePlanForPricing, v.loa, v.start_date, v.end_date)
  const adj = applyAdjustments(pricing, {
    discount: v.discount,
    discountType: v.discount_type ?? null,
    surcharge: v.surcharge,
  })
  const holdExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('quotes')
    .insert({
      xnid: `xnid:quote:${randomUUID()}`,
      marina_id: (plan as { marina_id: number }).marina_id,
      slip_id: v.slip_id ?? null,
      rate_plan_id: v.rate_plan_id,
      loa: v.loa,
      start_date: v.start_date.slice(0, 10),
      end_date: v.end_date.slice(0, 10),
      rate: pricing.nightly_total,
      total: adj.finalTotal,
      discount: adj.discountAmount > 0 ? adj.discountAmount : null,
      discount_type: adj.discountAmount > 0 ? (v.discount_type ?? null) : null,
      surcharge: adj.surchargeAmount > 0 ? adj.surchargeAmount : null,
      hold_expires_at: holdExpiresAt,
      status: 'draft',
    })
    .select('id')
    .single()
  if (error || !data) return { ok: false, error: 'Could not save the quote.' }
  revalidatePath(`/app/marina/${(plan as { marina_id: number }).marina_id}/pms`)
  return { ok: true, data: { id: data.id, holdExpiresAt } }
}

export async function deleteQuote(id: number, marinaId: number): Promise<PmsResult> {
  await requirePermission('marina', 'delete')
  const supabase = await createClient()
  const { data: q } = await supabase.from('quotes').select('reservation_id, status').eq('id', id).maybeSingle()
  if (!q) return { ok: false, error: 'Quote not found.' }
  if (q.reservation_id)
    return { ok: false, error: `Cannot delete — linked to reservation #${q.reservation_id}.` }
  if (q.status === 'accepted') return { ok: false, error: 'Cannot delete an accepted quote.' }
  const { error } = await supabase.from('quotes').delete().eq('id', id)
  if (error) return { ok: false, error: 'Could not delete the quote.' }
  revalidatePath(`/app/marina/${marinaId}/pms`)
  return { ok: true }
}

// ===========================================================================
// reservations  (ReservationController)
// ===========================================================================
const createReservationSchema = z.object({
  dock_id: z.coerce.number().int().positive(),
  boat_id: z.coerce.number().int().positive(),
  slip_id: z.coerce.number().int().positive().nullable().optional(),
  user_id: z.string().uuid(),
  marina_id: z.coerce.number().int().positive(),
  quote_payload: z.object({
    rate_plan_id: z.coerce.number().int().positive(),
    loa: z.coerce.number().int().positive(),
    start_date: z.string().trim().min(1),
    end_date: z.string().trim().min(1),
    rate: z.coerce.number(),
    subtotal: z.coerce.number(),
    discount: z.coerce.number().default(0),
    surcharge: z.coerce.number().default(0),
    tax: z.coerce.number(),
    total: z.coerce.number(),
  }),
})

/** `ReservationController@store` — atomic via `marina_create_reservation()`. */
export async function createReservation(input: unknown): Promise<PmsResult<{ id: number }>> {
  await requirePermission('marina', 'create')
  const parsed = createReservationSchema.safeParse(input)
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors }
  const v = parsed.data
  const qp = v.quote_payload
  if (qp.total <= 0 || qp.subtotal <= 0) return { ok: false, error: 'Invalid quote data detected.' }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('marina_create_reservation', {
    p_marina_id: v.marina_id,
    p_dock_id: v.dock_id,
    p_boat_id: v.boat_id,
    p_slip_id: v.slip_id ?? undefined,
    p_user_id: v.user_id,
    p_rate_plan_id: qp.rate_plan_id,
    p_loa: qp.loa,
    p_start_date: qp.start_date.slice(0, 10),
    p_end_date: qp.end_date.slice(0, 10),
    p_days: diffInDays(qp.start_date, qp.end_date),
    p_rate: qp.rate,
    p_subtotal: qp.subtotal,
    p_tax: qp.tax,
    p_total: qp.total,
    p_discount: qp.discount,
    p_surcharge: qp.surcharge,
  })
  if (error) {
    if (error.message.includes('not available')) return { ok: false, error: 'Boat or slip is not available for selected dates.' }
    if (error.message.includes('Invalid quote')) return { ok: false, error: 'Invalid quote data detected.' }
    return { ok: false, error: 'Could not create the reservation.' }
  }
  revalidatePath(`/app/marina/${v.marina_id}/pms`)
  return { ok: true, data: { id: data as number } }
}

// --- status machine (ReservationController::transitions) --------------------
const RESERVATION_TRANSITIONS: Record<string, string[]> = {
  draft: ['pending', 'cancelled'],
  pending: ['confirmed', 'waitlisted', 'cancelled', 'expired'],
  hold: ['pending', 'cancelled', 'expired'],
  confirmed: ['contract_required', 'waitlisted', 'cancelled', 'completed'],
  contract_required: ['contract_signed', 'cancelled', 'expired'],
  contract_signed: ['active', 'cancelled'],
  active: ['completed', 'cancelled'],
  waitlisted: ['confirmed', 'cancelled', 'expired'],
  cancelled: ['confirmed'],
  expired: [],
  completed: [],
}

function isValidReservationTransition(from: string, to: string): boolean {
  return (RESERVATION_TRANSITIONS[from] ?? []).includes(to)
}

/** `ReservationController::handleStatusChange` — cascade to assignment + stay. */
async function applyReservationStatusChange(
  supabase: Awaited<ReturnType<typeof createClient>>,
  reservationId: number,
  newStatus: string,
): Promise<void> {
  const { data: res } = await supabase
    .from('reservations')
    .select('id, assignments(id), stays(id)')
    .eq('id', reservationId)
    .maybeSingle()
  const assignmentId = ((res?.assignments as { id: number }[] | null) ?? [])[0]?.id ?? null
  const stayId = ((res?.stays as { id: number }[] | null) ?? [])[0]?.id ?? null
  const nowIso = new Date().toISOString().slice(0, 10)

  const setAssignment = async (status: string) => {
    if (assignmentId) await supabase.from('assignments').update({ status }).eq('id', assignmentId)
  }
  const setStay = async (patch: {
    status?: string
    actual_arrival?: string
    actual_departure?: string
  }) => {
    if (stayId) await supabase.from('stays').update(patch).eq('id', stayId)
  }

  switch (newStatus) {
    case 'confirmed':
      await setAssignment('unassigned')
      break
    case 'contract_signed':
      await setAssignment('assigned')
      await setStay({ status: 'expected' })
      break
    case 'active':
      await setStay({ actual_arrival: nowIso, status: 'checked_in' })
      break
    case 'completed':
      await setStay({ actual_departure: nowIso, status: 'checked_out' })
      await setAssignment('released')
      break
    case 'cancelled':
      await setAssignment('unassigned')
      await setStay({ status: 'cancelled' })
      break
    case 'expired':
      await setAssignment('released')
      await setStay({ status: 'expired' })
      break
    case 'waitlisted':
      await setAssignment('unassigned')
      break
  }
}

const updateReservationSchema = z.object({
  id: z.coerce.number().int().positive(),
  marina_id: z.coerce.number().int().positive(),
  status: z.string().trim().min(1).optional(),
  start_date: z.string().trim().min(1).optional(),
  end_date: z.string().trim().min(1).optional(),
  boat_id: z.coerce.number().int().positive().optional(),
  slip_id: z.coerce.number().int().positive().nullable().optional(),
  rate_plan_id: z.coerce.number().int().positive().optional(),
})

/** `ReservationController@update` — status transition + date/slip edits. */
export async function updateReservation(input: unknown): Promise<PmsResult> {
  await requirePermission('marina', 'update')
  const parsed = updateReservationSchema.safeParse(input)
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors }
  const v = parsed.data
  const supabase = await createClient()

  const { data: current } = await supabase
    .from('reservations')
    .select('id, status, start_date, end_date, boat_id, slip_id, rate_plan_id, billed_by')
    .eq('id', v.id)
    .maybeSingle()
  if (!current) return { ok: false, error: 'Reservation not found.' }

  const oldStatus = current.status
  const newStatus = v.status ?? oldStatus
  const start = (v.start_date ?? current.start_date ?? '').slice(0, 10)
  const end = (v.end_date ?? current.end_date ?? '').slice(0, 10)
  const boatId = v.boat_id ?? current.boat_id
  const slipId = v.slip_id === undefined ? current.slip_id : v.slip_id

  if (newStatus !== oldStatus) {
    if (['expired', 'completed'].includes(oldStatus))
      return { ok: false, error: `Reservation is '${oldStatus}' and cannot be changed.` }
    if (!isValidReservationTransition(oldStatus, newStatus))
      return { ok: false, error: 'Invalid status transition.' }
  }

  const blocking = ['confirmed', 'hold', 'contract_required', 'contract_signed', 'active']
  if (blocking.includes(newStatus) && start && end) {
    const { data: others } = await supabase
      .from('reservations')
      .select('id, boat_id, slip_id, start_date, end_date, status')
      .neq('id', v.id)
      .in('status', blocking)
    const conflict = (others ?? []).some(
      (o) =>
        (o.boat_id === boatId || (slipId != null && o.slip_id === slipId)) &&
        (o.start_date ?? '').slice(0, 10) < end &&
        (o.end_date ?? '').slice(0, 10) > start,
    )
    if (conflict) return { ok: false, error: 'Boat or slip already booked for selected dates.' }
  }

  const patch: {
    start_date: string | null
    end_date: string | null
    boat_id: number | null
    slip_id: number | null
    days?: number
    status?: string
    rate_plan_id?: number
  } = {
    start_date: start || null,
    end_date: end || null,
    boat_id: boatId,
    slip_id: slipId,
  }
  if (start && end) patch.days = diffInDays(start, end)
  if (newStatus !== oldStatus) patch.status = newStatus
  if (current.billed_by !== 'admin' && v.rate_plan_id) patch.rate_plan_id = v.rate_plan_id

  const { error } = await supabase.from('reservations').update(patch).eq('id', v.id)
  if (error) return { ok: false, error: 'Could not update the reservation.' }

  if (newStatus !== oldStatus) await applyReservationStatusChange(supabase, v.id, newStatus)

  revalidatePath(`/app/marina/${v.marina_id}/pms`)
  revalidatePath(`/app/marina/${v.marina_id}/pms/reservations/${v.id}`)
  return { ok: true }
}

/**
 * `ReservationController@confirm` — pending → confirmed. Reconstructs the
 * commented-out `findAvailableSlip`: an active slip on the dock whose LOA range
 * admits the boat and which has no overlapping reservation. If one is free the
 * assignment is filled + the stay becomes `expected`, and a month-plus stay
 * spawns a `required` contract; otherwise the reservation is waitlisted.
 */
export async function confirmReservation(id: number, marinaId: number): Promise<PmsResult<{ status: string }>> {
  await requirePermission('marina', 'update')
  const supabase = await createClient()

  const { data: res } = await supabase
    .from('reservations')
    .select(
      'id, status, dock_id, boat_id, rate_plan_id, start_date, end_date, days, rate, boat:boats(boat_loa), assignments(id), stays(id)',
    )
    .eq('id', id)
    .maybeSingle()
  if (!res) return { ok: false, error: 'Reservation not found.' }
  if (res.status !== 'pending') return { ok: false, error: 'Reservation must be pending to confirm.' }

  await supabase.from('reservations').update({ status: 'confirmed' }).eq('id', id)

  const assignmentId = ((res.assignments as { id: number }[] | null) ?? [])[0]?.id ?? null
  const stayId = ((res.stays as { id: number }[] | null) ?? [])[0]?.id ?? null
  const boatLoa = Number((res.boat as { boat_loa?: string | null } | null)?.boat_loa ?? 0)

  if (!assignmentId || !res.dock_id || !res.start_date || !res.end_date) {
    return { ok: true, data: { status: 'confirmed' } }
  }

  const slip = await findAvailableSlip(supabase, res.dock_id, res.start_date, res.end_date, boatLoa)
  if (!slip) {
    await supabase.from('reservations').update({ status: 'waitlisted' }).eq('id', id)
    return { ok: true, data: { status: 'waitlisted' } }
  }

  await supabase.from('assignments').update({ slip_id: slip.id, status: 'assigned' }).eq('id', assignmentId)
  if (stayId) await supabase.from('stays').update({ status: 'expected', slip_id: slip.id }).eq('id', stayId)

  if ((res.days ?? 0) > 30) {
    await supabase.from('contracts').insert({
      xnid: `xnid:contract:${randomUUID()}`,
      marina_id: marinaId,
      reservation_id: id,
      slip_id: slip.id,
      boat_id: res.boat_id!,
      rate_plan_id: res.rate_plan_id!,
      monthly_rate: phpRound(Number(res.rate ?? 0) * 30, 2),
      status: 'required',
    })
  }

  revalidatePath(`/app/marina/${marinaId}/pms`)
  return { ok: true, data: { status: 'confirmed' } }
}

/** Reconstructed `ReservationController::findAvailableSlip` (commented-out body). */
async function findAvailableSlip(
  supabase: Awaited<ReturnType<typeof createClient>>,
  dockId: number,
  start: string,
  end: string,
  boatLoa: number,
): Promise<{ id: number } | null> {
  const { data: slips } = await supabase
    .from('slips')
    .select('id, min_loa, max_loa')
    .eq('dock_id', dockId)
    .eq('is_active', true)
  const fitting = (slips ?? []).filter(
    (s) => (s.min_loa == null || s.min_loa <= boatLoa) && (s.max_loa == null || s.max_loa >= boatLoa),
  )
  if (fitting.length === 0) return null

  const { data: reservations } = await supabase
    .from('reservations')
    .select('slip_id, start_date, end_date')
    .in(
      'slip_id',
      fitting.map((s) => s.id),
    )
  const s0 = start.slice(0, 10)
  const e0 = end.slice(0, 10)
  const blocked = new Set<number>()
  for (const r of reservations ?? []) {
    if (r.slip_id == null) continue
    const rs = (r.start_date ?? '').slice(0, 10)
    const re = (r.end_date ?? '').slice(0, 10)
    if ((rs >= s0 && rs <= e0) || (re >= s0 && re <= e0) || (rs <= s0 && re >= e0)) blocked.add(r.slip_id)
  }
  const free = fitting.find((s) => !blocked.has(s.id))
  return free ? { id: free.id } : null
}

export async function deleteReservation(id: number, marinaId: number): Promise<PmsResult> {
  await requirePermission('marina', 'delete')
  const supabase = await createClient()
  const { data: res } = await supabase.from('reservations').select('status').eq('id', id).maybeSingle()
  if (!res) return { ok: false, error: 'Reservation not found.' }
  if (!['cancelled', 'expired'].includes(res.status))
    return { ok: false, error: `Cannot delete — status is '${res.status}'. Cancel it first.` }

  // release the linked quote, then delete the reservation (FK cascades wipe
  // assignments / stays / contracts / pos_transactions).
  await supabase.from('quotes').update({ reservation_id: null, status: 'expired' }).eq('reservation_id', id)
  const { error } = await supabase.from('reservations').delete().eq('id', id)
  if (error) return { ok: false, error: 'Could not delete the reservation.' }
  revalidatePath(`/app/marina/${marinaId}/pms`)
  return { ok: true }
}

// ===========================================================================
// assignment toggle  (ReservationController@toggleAssignment)
// ===========================================================================
const toggleSchema = z.object({
  reservation_id: z.coerce.number().int().positive(),
  marina_id: z.coerce.number().int().positive(),
  action: z.enum(['assigned', 'unassigned']),
  boat_id: z.coerce.number().int().positive().optional(),
  slip_id: z.coerce.number().int().positive().optional(),
  start_date: z.string().trim().min(1).optional(),
  end_date: z.string().trim().min(1).optional(),
})

/**
 * `ReservationController@toggleAssignment`. Assign fills the assignment + stay
 * and — when there is no live contract — spawns a bare `required` contract and
 * moves the reservation to `confirmed`. The contract PDF / `send` / e-sign flow
 * is slice 8b; here the row is created without a document.
 */
export async function toggleAssignment(input: unknown): Promise<PmsResult> {
  await requirePermission('marina', 'create')
  const parsed = toggleSchema.safeParse(input)
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors }
  const v = parsed.data
  const supabase = await createClient()

  const { data: res } = await supabase
    .from('reservations')
    .select('id, rate_plan_id, assignments(id, status), stays(id), contracts(id, status)')
    .eq('id', v.reservation_id)
    .maybeSingle()
  if (!res) return { ok: false, error: 'Reservation not found.' }

  const assignment: { id: number; status: string } | undefined = ((res.assignments as
    | { id: number; status: string }[]
    | null) ?? [])[0]
  const stayId = ((res.stays as { id: number }[] | null) ?? [])[0]?.id ?? null
  const contracts = (res.contracts as { id: number; status: string }[] | null) ?? []
  const liveContract = contracts.find((c) => !['expired', 'cancelled'].includes(c.status))

  if (v.action === 'unassigned') {
    if (!assignment) return { ok: false, error: 'No assignment found to unassign.' }
    await supabase.from('assignments').update({ status: 'unassigned' }).eq('id', assignment.id)
    if (stayId) await supabase.from('stays').update({ status: 'pending' }).eq('id', stayId)
    revalidatePath(`/app/marina/${v.marina_id}/pms/reservations/${v.reservation_id}`)
    return { ok: true }
  }

  // assign
  if (!v.boat_id || !v.slip_id || !v.start_date || !v.end_date)
    return { ok: false, error: 'boat, slip and dates are required to assign.' }

  const assignmentPatchBase = {
    boat_id: v.boat_id,
    slip_id: v.slip_id,
    start_date: v.start_date.slice(0, 10),
    end_date: v.end_date.slice(0, 10),
    status: 'assigned' as const,
  }
  let assignmentId: number | null = assignment?.id ?? null
  if (assignmentId) {
    await supabase.from('assignments').update(assignmentPatchBase).eq('id', assignmentId)
  } else {
    const { data } = await supabase
      .from('assignments')
      .insert({
        ...assignmentPatchBase,
        xnid: `xnid:assignment:${randomUUID()}`,
        marina_id: v.marina_id,
        reservation_id: v.reservation_id,
      })
      .select('id')
      .single()
    assignmentId = data?.id ?? null
  }
  if (!assignmentId) return { ok: false, error: 'Could not save the assignment.' }

  const stayPatch = {
    reservation_id: v.reservation_id,
    boat_id: v.boat_id,
    slip_id: v.slip_id,
    expected_arrival: v.start_date.slice(0, 10),
    expected_departure: v.end_date.slice(0, 10),
    status: 'expected' as const,
  }
  if (stayId) {
    await supabase.from('stays').update(stayPatch).eq('id', stayId)
  } else {
    await supabase.from('stays').insert({
      ...stayPatch,
      xnid: `xnid:stay:${randomUUID()}`,
      marina_id: v.marina_id,
      assignment_id: assignmentId,
    })
  }

  if (!liveContract && res.rate_plan_id) {
    await supabase.from('contracts').insert({
      xnid: `xnid:contract:${randomUUID()}`,
      marina_id: v.marina_id,
      reservation_id: v.reservation_id,
      slip_id: v.slip_id,
      boat_id: v.boat_id,
      rate_plan_id: res.rate_plan_id,
      monthly_rate: 0,
      status: 'required',
    })
    await supabase.from('reservations').update({ status: 'confirmed' }).eq('id', v.reservation_id)
  }

  revalidatePath(`/app/marina/${v.marina_id}/pms/reservations/${v.reservation_id}`)
  return { ok: true }
}
