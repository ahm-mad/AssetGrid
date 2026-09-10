'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createClient } from '@/utils/supabase/server'
import { requirePermission } from '@/lib/auth/guards'
import { getStripe, isStripeConfigured } from '@/lib/billing/stripe'
import type { Database } from '@/lib/database.types'

/**
 * Plan CRUD — ports `PlanController@store` / `@update` / `@destroy` +
 * `@syncFromStripe` (the last one is a **broken route** in the old app — the
 * method doesn't exist, 500 BadMethodCallException — so its intent is
 * reconstructed here). Old middleware: `permission:commerce,*,customer`.
 *
 * When Stripe is not configured the plan row is still written; the Stripe
 * product/price sync is skipped and the result carries a `warning`.
 */

export interface PlanActionResult {
  ok: boolean
  error?: string
  warning?: string
  fieldErrors?: Record<string, string[]>
  id?: number
}

const REVALIDATE = '/app/billing/plans'
const BILLING_MODES = ['direct', 'dealer_assisted', 'dealer_billed'] as const

const planSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  plan_code: z.string().trim().min(1).max(191),
  name: z.string().trim().min(1).max(191),
  plan_family: z.enum(['consumer', 'operator', 'hybrid']).default('consumer'),
  device_limit: z.coerce.number().int().min(-1).default(1),
  amount: z.coerce.number().nonnegative().default(0),
  billing_type: z.enum(['one_time', 'recurring', 'hybrid']).default('one_time'),
  billing_interval: z.enum(['year', 'month']).nullable().optional(),
  billing_modes: z.array(z.enum(BILLING_MODES)).min(1),
  activation_type: z.string().trim().max(64).default('Single'),
  requires_provisioning: z.coerce.boolean().default(false),
  provisioning_amount: z.coerce.number().nonnegative().nullable().optional(),
  max_devices_per_batch: z.coerce.number().int().positive().nullable().optional(),
  tags: z.string().trim().max(191).optional().default(''),
  notes: z.string().trim().max(4000).optional().default(''),
})

export async function savePlan(input: unknown): Promise<PlanActionResult> {
  const hasId = !!(input && (input as { id?: unknown }).id)
  await requirePermission('commerce', hasId ? 'update' : 'create', { allowCustomer: true })
  const parsed = planSchema.safeParse(input)
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors }
  const v = parsed.data
  const supabase = await createClient()

  if (v.billing_type !== 'one_time' && !v.billing_interval) {
    return { ok: false, fieldErrors: { billing_interval: ['Required for recurring / hybrid plans.'] } }
  }

  let warning: string | undefined

  // ---- update -----------------------------------------------------------
  if (v.id) {
    const { data: existing } = await supabase
      .from('plans')
      .select('*')
      .eq('id', v.id)
      .maybeSingle()
    if (!existing) return { ok: false, error: 'Plan not found.' }
    if (v.billing_type !== existing.billing_type) {
      return { ok: false, error: 'Changing billing type is not allowed. Create a new plan instead.' }
    }

    const patch: Database['public']['Tables']['plans']['Update'] = {
      name: v.name,
      amount: v.amount,
      billing_interval: v.billing_interval ?? null,
      billing_modes: v.billing_modes,
      plan_family: v.plan_family,
      device_limit: v.device_limit,
      activation_type: v.activation_type,
      requires_provisioning: v.requires_provisioning,
      max_devices_per_batch: v.max_devices_per_batch ?? null,
      tags: v.tags || null,
      notes: v.notes || null,
    }

    if (isStripeConfigured() && existing.stripe_product_id) {
      try {
        const stripe = getStripe()
        if (v.name !== existing.name) {
          await stripe.products.update(existing.stripe_product_id, { name: v.name })
        }
        const amountChanged = v.amount !== Number(existing.amount)
        const intervalChanged = (v.billing_interval ?? null) !== existing.billing_interval
        if (amountChanged || intervalChanged) {
          if (existing.stripe_price_id) {
            await stripe.prices.update(existing.stripe_price_id, { active: false })
          }
          const price = await stripe.prices.create({
            product: existing.stripe_product_id,
            unit_amount: Math.round(v.amount * 100),
            currency: 'usd',
            ...(existing.billing_type !== 'one_time'
              ? { recurring: { interval: (v.billing_interval ?? existing.billing_interval ?? 'month') as 'year' | 'month' } }
              : {}),
          })
          patch.stripe_price_id = price.id
        }
        if (existing.billing_type === 'hybrid' && v.provisioning_amount != null) {
          if (existing.provisioning_price_id) {
            await stripe.prices.update(existing.provisioning_price_id, { active: false })
          }
          const prov = await stripe.prices.create({
            product: existing.stripe_product_id,
            unit_amount: Math.round(v.provisioning_amount * 100),
            currency: 'usd',
          })
          patch.provisioning_price_id = prov.id
        }
      } catch (e) {
        warning = `Plan saved; Stripe sync failed: ${(e as Error).message}`
      }
    } else if (!isStripeConfigured()) {
      warning = 'Plan saved; Stripe is not configured so no product/price was updated.'
    }

    const { error } = await supabase.from('plans').update(patch).eq('id', v.id)
    if (error) return { ok: false, error: 'Could not update the plan.' }
    revalidatePath(REVALIDATE)
    return { ok: true, id: v.id, warning }
  }

  // ---- create ----------------------------------------------------------
  const row: Database['public']['Tables']['plans']['Insert'] = {
    plan_code: v.plan_code,
    name: v.name,
    plan_family: v.plan_family,
    device_limit: v.device_limit,
    amount: v.amount,
    billing_type: v.billing_type,
    billing_interval: v.billing_interval ?? null,
    billing_modes: v.billing_modes,
    activation_type: v.activation_type,
    requires_provisioning: v.requires_provisioning,
    max_devices_per_batch: v.max_devices_per_batch ?? null,
    tags: v.tags || null,
    notes: v.notes || null,
  }

  if (isStripeConfigured()) {
    try {
      const stripe = getStripe()
      const product = await stripe.products.create({
        name: v.name,
        metadata: { plan_code: v.plan_code, billing_type: v.billing_type },
      })
      row.stripe_product_id = product.id

      const priceBase = { product: product.id, unit_amount: Math.round(v.amount * 100), currency: 'usd' as const }
      const price =
        v.billing_type === 'one_time'
          ? await stripe.prices.create(priceBase)
          : await stripe.prices.create({
              ...priceBase,
              recurring: { interval: (v.billing_interval ?? 'month') as 'year' | 'month' },
            })
      row.stripe_price_id = price.id

      if (v.billing_type === 'hybrid' && v.provisioning_amount) {
        const prov = await stripe.prices.create({
          product: product.id,
          unit_amount: Math.round(v.provisioning_amount * 100),
          currency: 'usd',
        })
        row.provisioning_price_id = prov.id
      }
    } catch (e) {
      warning = `Plan created; Stripe product/price failed: ${(e as Error).message}`
    }
  } else {
    warning = 'Plan created; Stripe is not configured so no Stripe product/price was created.'
  }

  const { data, error } = await supabase.from('plans').insert(row).select('id').single()
  if (error || !data) return { ok: false, error: 'Could not create the plan (code already used?).' }
  revalidatePath(REVALIDATE)
  return { ok: true, id: data.id, warning }
}

export async function deletePlan(id: number): Promise<PlanActionResult> {
  await requirePermission('commerce', 'delete', { allowCustomer: true })
  const supabase = await createClient()
  const { data: plan } = await supabase
    .from('plans')
    .select('stripe_product_id')
    .eq('id', id)
    .maybeSingle()

  if (plan?.stripe_product_id && isStripeConfigured()) {
    try {
      await getStripe().products.update(plan.stripe_product_id, { active: false })
    } catch {
      // non-fatal
    }
  }

  const { error } = await supabase
    .from('plans')
    .update({ is_active: false, deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { ok: false, error: 'Could not deactivate the plan.' }
  revalidatePath(REVALIDATE)
  return { ok: true }
}

export async function togglePlanActive(id: number, active: boolean): Promise<PlanActionResult> {
  await requirePermission('commerce', 'update', { allowCustomer: true })
  const supabase = await createClient()
  const { error } = await supabase.from('plans').update({ is_active: active }).eq('id', id)
  if (error) return { ok: false, error: 'Could not toggle the plan.' }
  revalidatePath(REVALIDATE)
  return { ok: true }
}

/**
 * `POST plans/{plan}/sync` — reconstructed. Pull the plan's Stripe product +
 * default price and refresh `name` / `amount` / `billing_interval` /
 * `stripe_price_id` / `is_active` from Stripe.
 */
export async function syncPlanFromStripe(id: number): Promise<PlanActionResult> {
  await requirePermission('commerce', 'create', { allowCustomer: true })
  if (!isStripeConfigured()) return { ok: false, error: 'Stripe is not configured.' }

  const supabase = await createClient()
  const { data: plan } = await supabase
    .from('plans')
    .select('id, stripe_product_id, stripe_price_id')
    .eq('id', id)
    .maybeSingle()
  if (!plan) return { ok: false, error: 'Plan not found.' }
  if (!plan.stripe_product_id) return { ok: false, error: 'Plan has no Stripe product.' }

  try {
    const stripe = getStripe()
    const product = await stripe.products.retrieve(plan.stripe_product_id)
    const patch: Database['public']['Tables']['plans']['Update'] = {
      name: product.name,
      is_active: product.active,
    }

    const priceId =
      (typeof product.default_price === 'string' ? product.default_price : product.default_price?.id) ??
      plan.stripe_price_id
    if (priceId) {
      const price = await stripe.prices.retrieve(priceId)
      patch.stripe_price_id = price.id
      if (price.unit_amount != null) patch.amount = price.unit_amount / 100
      if (price.recurring?.interval === 'year' || price.recurring?.interval === 'month') {
        patch.billing_interval = price.recurring.interval
      }
    }

    const { error } = await supabase.from('plans').update(patch).eq('id', id)
    if (error) return { ok: false, error: 'Could not save the synced plan.' }
    revalidatePath(REVALIDATE)
    return { ok: true, id }
  } catch (e) {
    return { ok: false, error: `Stripe sync failed: ${(e as Error).message}` }
  }
}
