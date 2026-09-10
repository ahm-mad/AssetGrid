'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { requireAuth } from '@/lib/auth/guards'
import { can } from '@/lib/auth/permissions'
import { createServiceClient } from '@/utils/supabase/service'
import { getStripe, isStripeConfigured, siteUrl } from '@/lib/billing/stripe'
import type { Database } from '@/lib/database.types'

/**
 * `POST /api/process-payment` (`Payment\PaymentController@processPayment`) →
 * a Server Action. Creates / reuses an `activation_attempts` row (idempotent),
 * then either completes a `dealer_billed` activation inline or creates a Stripe
 * Checkout Session and returns its URL.
 *
 * 🔧 The old route was **guest** (no auth). Here it requires an authenticated
 * caller; a non-commerce user may only run it for their own devices.
 *
 * Uses the service-role client — it writes across `activation_attempts`,
 * `subscription_entitlements`, `device_assignments`, `user_devices`, `payments`
 * in one logical unit, the same way the webhook handler does.
 */

export interface CheckoutResult {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string[]>
  checkoutUrl?: string
  reused?: boolean
  completed?: boolean
}

const BILLING_MODES = ['direct', 'dealer_assisted', 'dealer_billed'] as const

const schema = z.object({
  user_id: z.string().uuid(),
  plan_id: z.coerce.number().int().positive(),
  user_device_ids: z.array(z.coerce.number().int().positive()).min(1),
  billing_mode: z.enum(BILLING_MODES).default('direct'),
  owner_xnid: z.string().trim().optional(),
  billing_xnid: z.string().trim().optional(),
  dealer_xnid: z.string().trim().optional(),
})

export async function startCheckout(input: unknown): Promise<CheckoutResult> {
  const actor = await requireAuth()
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors }
  const v = parsed.data

  const isCommerce = actor.isSuperAdmin || can(actor.permissions, 'commerce', 'create')
  if (!isCommerce && v.user_id !== actor.id) {
    return { ok: false, error: 'You can only activate your own devices.' }
  }
  if (v.billing_mode === 'dealer_assisted' && !v.dealer_xnid) {
    return { ok: false, fieldErrors: { dealer_xnid: ['Required for dealer_assisted billing mode.'] } }
  }
  if (v.billing_mode !== 'dealer_billed' && !isStripeConfigured()) {
    return { ok: false, error: 'Stripe is not configured — only dealer_billed activation is available.' }
  }

  const db = createServiceClient()

  const { data: user } = await db
    .from('profiles')
    .select('id, xnid')
    .eq('id', v.user_id)
    .maybeSingle()
  if (!user) return { ok: false, error: 'User not found.' }
  const { data: authUser } = await db.auth.admin.getUserById(v.user_id)
  const email = authUser.user?.email
  if (!email) return { ok: false, error: 'User has no email.' }

  const { data: plan } = await db.from('plans').select('*').eq('id', v.plan_id).maybeSingle()
  if (!plan) return { ok: false, error: 'Plan not found.' }

  // Resolve devices — must belong to the user and not be captured yet.
  const { data: devices } = await db
    .from('user_devices')
    .select('id, xnid, status')
    .in('id', v.user_device_ids)
    .eq('user_id', v.user_id)
  const valid = (devices ?? []).filter((d) => d.status !== 'captured' && d.xnid)
  if (valid.length === 0) return { ok: false, error: 'No valid devices found.' }

  if (plan.plan_code === 'sentinel' && valid.length !== 1) {
    return { ok: false, error: 'Sentinel requires exactly 1 device.' }
  }

  const deviceXnids = valid.map((d) => d.xnid as string).sort()
  const ownerXnid = v.owner_xnid ?? user.xnid ?? null
  const billingXnid =
    v.billing_xnid ?? (v.billing_mode === 'dealer_assisted' ? ownerXnid : null)
  const provider: Database['public']['Enums']['payment_provider'] = 'stripe'

  // ---- Idempotency: reuse an open pending attempt for the same device set ----
  const { data: recentAttempts } = await db
    .from('activation_attempts')
    .select('id, checkout_session_id, created_at, devices:activation_attempt_devices(xnid)')
    .eq('email', email)
    .eq('plan_id', plan.id)
    .eq('payment_provider', provider)
    .eq('status', 'pending')
    .gte('created_at', new Date(Date.now() - 30 * 60_000).toISOString())
    .order('created_at', { ascending: false })
    .limit(1)

  const existing = recentAttempts?.[0]
  if (existing) {
    const existingXnids = ((existing.devices as { xnid: string }[] | null) ?? [])
      .map((d) => d.xnid)
      .sort()
    if (
      existingXnids.length === deviceXnids.length &&
      existingXnids.every((x, i) => x === deviceXnids[i]) &&
      existing.checkout_session_id &&
      isStripeConfigured()
    ) {
      try {
        const session = await getStripe().checkout.sessions.retrieve(existing.checkout_session_id)
        if (session.status === 'open' && session.url) {
          return { ok: true, checkoutUrl: session.url, reused: true }
        }
      } catch {
        // fall through and make a new attempt
      }
    }
  }

  // ---- Create the attempt + its device rows ----
  const { data: attempt, error: aErr } = await db
    .from('activation_attempts')
    .insert({
      email,
      user_id: v.user_id,
      plan_id: plan.id,
      device_count: valid.length,
      billing_mode: v.billing_mode,
      owner_xnid: ownerXnid,
      billing_xnid: billingXnid,
      dealer_xnid: v.dealer_xnid ?? null,
      status: 'pending',
      payment_provider: provider,
    })
    .select('id')
    .single()
  if (aErr || !attempt) return { ok: false, error: 'Could not create the activation attempt.' }

  await db.from('activation_attempt_devices').upsert(
    valid.map((d) => ({
      activation_attempt_id: attempt.id,
      xnid: d.xnid as string,
      validation_status: 'validated',
      activation_status: 'pending',
    })),
    { onConflict: 'activation_attempt_id,xnid' },
  )

  // ---- dealer_billed: complete inline, no Stripe ----
  if (v.billing_mode === 'dealer_billed') {
    const { data: ent } = await db
      .from('subscription_entitlements')
      .insert({
        plan_id: plan.id,
        user_id: v.user_id,
        payment_provider: provider,
        billing_mode: 'dealer_billed',
        owner_xnid: ownerXnid,
        billing_xnid: billingXnid,
        dealer_xnid: v.dealer_xnid ?? null,
        source: 'admin', // old code wrote 'manual' — mapped to the enum value
        max_devices_allowed: plan.device_limit,
        active_device_count: valid.length,
        status: 'active',
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    if (!ent) return { ok: false, error: 'Could not create the entitlement.' }

    for (const d of valid) {
      await db
        .from('device_assignments')
        .upsert(
          { xnid: d.xnid as string, entitlement_id: ent.id, assigned_at: new Date().toISOString(), status: 'active' },
          { onConflict: 'xnid,entitlement_id' },
        )
      await db
        .from('user_devices')
        .update({
          status: 'captured',
          entitlement_id: ent.id,
          activation_status: 'activated',
          activated_at: new Date().toISOString(),
        })
        .eq('id', d.id)
    }

    await db
      .from('payments')
      .upsert(
        {
          provider_invoice_id: `dealer_${attempt.id}`,
          xnid: ownerXnid ?? (valid[0].xnid as string),
          amount: 0,
          payment_method: 'dealer_billed',
          payment_provider: provider,
        },
        { onConflict: 'provider_invoice_id' },
      )

    await db
      .from('activation_attempts')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', attempt.id)

    revalidatePath('/app/billing')
    return { ok: true, completed: true }
  }

  // ---- Stripe checkout ----
  const stripe = getStripe()
  const mode = plan.billing_type.toLowerCase() === 'one_time' ? 'payment' : 'subscription'
  const lineItems: { price: string; quantity: number }[] = []
  if (!plan.stripe_price_id) return { ok: false, error: 'Plan is not configured for billing.' }
  lineItems.push({ price: plan.stripe_price_id, quantity: valid.length })

  let effectiveMode: 'payment' | 'subscription' = mode
  if (plan.plan_code === 'voyager') {
    effectiveMode = 'subscription'
    if (!plan.provisioning_price_id) {
      return { ok: false, error: 'Voyager plan is missing provisioning_price_id.' }
    }
    lineItems.push({ price: plan.provisioning_price_id, quantity: valid.length })
  }

  try {
    const session = await stripe.checkout.sessions.create({
      line_items: lineItems,
      mode: effectiveMode,
      success_url: `${siteUrl()}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl()}/checkout/cancel`,
      customer_email: email,
      client_reference_id: String(attempt.id),
      metadata: {
        activation_attempt_id: String(attempt.id),
        plan_code: plan.plan_code,
        billing_mode: v.billing_mode,
        dealer_xnid: v.dealer_xnid ?? '',
        provider,
      },
      ...(effectiveMode === 'subscription'
        ? {
            subscription_data: {
              metadata: {
                activation_attempt_id: String(attempt.id),
                billing_mode: v.billing_mode,
                dealer_xnid: v.dealer_xnid ?? '',
              },
            },
          }
        : {}),
    })

    await db.from('activation_attempts').update({ checkout_session_id: session.id }).eq('id', attempt.id)
    await db
      .from('user_devices')
      .update({ status: 'decline', session_id: session.id })
      .in('id', valid.map((d) => d.id))

    return { ok: true, checkoutUrl: session.url ?? undefined }
  } catch (e) {
    await db.from('activation_attempts').update({ status: 'failed' }).eq('id', attempt.id)
    return { ok: false, error: `Stripe checkout failed: ${(e as Error).message}` }
  }
}
