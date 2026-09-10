import 'server-only'

import type Stripe from 'stripe'

import { createServiceClient } from '@/utils/supabase/service'
import { getStripe } from '@/lib/billing/stripe'

/**
 * Stripe webhook handlers — a port of `App\Services\StripeWebhookService` +
 * the `checkout.session.completed` block of `Payment\PaymentController@webhook`.
 *
 * All writes go through the service-role client (there is no user in a webhook)
 * and are idempotent: `payments.provider_invoice_id` is unique,
 * `device_assignments (xnid, entitlement_id)` is unique, and each handler
 * bails early if the attempt is already `completed`. The old code used
 * `lockForUpdate`; Postgres equivalent here is the unique constraints plus the
 * "already completed" guard (Supabase-js has no row lock — acceptable because
 * Stripe delivers webhooks serially per object and the unique keys catch races).
 */

type ServiceDb = ReturnType<typeof createServiceClient>

async function recordPayment(
  db: ServiceDb,
  opts: { invoiceId: string | null; xnid: string | null; amountCents: number; method: string },
): Promise<{ id: number } | null> {
  if (!opts.invoiceId) return null
  const { data: existing } = await db
    .from('payments')
    .select('id')
    .eq('provider_invoice_id', opts.invoiceId)
    .maybeSingle()
  if (existing) return existing

  const { data } = await db
    .from('payments')
    .insert({
      provider_invoice_id: opts.invoiceId,
      xnid: opts.xnid,
      amount: Math.round(opts.amountCents) / 100,
      payment_method: opts.method,
      payment_provider: 'stripe',
    })
    .select('id')
    .single()
  return data ?? null
}

async function recordPaymentDetails(
  db: ServiceDb,
  paymentId: number,
  charge: Stripe.Charge | null,
): Promise<void> {
  if (!charge) return
  const card = charge.payment_method_details?.card
  if (!card) return
  const [firstName, lastName] = (charge.billing_details?.name ?? '').trim().split(/\s+(.+)/)
  const addr = charge.billing_details?.address
  await db.from('payment_details').upsert(
    {
      payment_id: paymentId,
      card_last4: card.last4 ?? null,
      card_brand: card.brand ?? null,
      month: card.exp_month ? String(card.exp_month) : null,
      year: card.exp_year ? String(card.exp_year) : null,
      first_name: firstName || null,
      last_name: lastName || null,
      city: addr?.city ?? null,
      zip_code: addr?.postal_code ?? null,
      state: addr?.state ?? null,
      country: addr?.country ?? null,
      address_1: addr?.line1 ?? 'unknown',
      address_2: addr?.line2 ?? null,
    },
    { onConflict: 'payment_id' },
  )
}

/** `Invoice.subscription` was removed from the SDK types in recent versions — read it defensively. */
function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const raw = (invoice as unknown as { subscription?: unknown }).subscription
  return typeof raw === 'string' ? raw : null
}

async function chargeFor(invoiceOrSession: { charge?: unknown; payment_intent?: unknown }): Promise<Stripe.Charge | null> {
  try {
    const chargeId =
      typeof invoiceOrSession.charge === 'string' ? invoiceOrSession.charge : null
    if (chargeId) return await getStripe().charges.retrieve(chargeId)
    const piId =
      typeof invoiceOrSession.payment_intent === 'string' ? invoiceOrSession.payment_intent : null
    if (piId) {
      const pi = await getStripe().paymentIntents.retrieve(piId, { expand: ['latest_charge'] })
      return (pi.latest_charge as Stripe.Charge) ?? null
    }
  } catch {
    // non-fatal
  }
  return null
}

// ---------------------------------------------------------------------------
// checkout.session.completed  (mode = 'payment')
// ---------------------------------------------------------------------------
export async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  if (session.mode !== 'payment') return
  const attemptId = session.client_reference_id
  if (!attemptId) return

  const db = createServiceClient()
  const { data: attempt } = await db
    .from('activation_attempts')
    .select('id, status, plan_id, user_id, billing_mode, owner_xnid, billing_xnid, dealer_xnid, devices:activation_attempt_devices(xnid)')
    .eq('id', Number(attemptId))
    .maybeSingle()
  if (!attempt || attempt.status === 'completed') return

  const { data: plan } = await db
    .from('plans')
    .select('device_limit')
    .eq('id', attempt.plan_id)
    .maybeSingle()
  const attemptDevices = (attempt.devices as { xnid: string }[] | null) ?? []

  const { data: ent } = await db
    .from('subscription_entitlements')
    .insert({
      plan_id: attempt.plan_id,
      user_id: attempt.user_id,
      billing_mode: attempt.billing_mode,
      owner_xnid: attempt.owner_xnid,
      billing_xnid: attempt.billing_xnid,
      dealer_xnid: attempt.dealer_xnid,
      source: 'stripe',
      provider_customer_id: typeof session.customer === 'string' ? session.customer : null,
      max_devices_allowed: plan?.device_limit ?? null,
      active_device_count: attemptDevices.length,
      status: 'active',
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (!ent) return

  for (const ad of attemptDevices) {
    await db
      .from('device_assignments')
      .upsert(
        { xnid: ad.xnid, entitlement_id: ent.id, assigned_at: new Date().toISOString(), status: 'active' },
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
      .eq('xnid', ad.xnid)
  }

  const payment = await recordPayment(db, {
    invoiceId: typeof session.payment_intent === 'string' ? session.payment_intent : null,
    xnid: attempt.owner_xnid ?? attemptDevices[0]?.xnid ?? null,
    amountCents: session.amount_total ?? 0,
    method: 'stripe',
  })
  if (payment) await recordPaymentDetails(db, payment.id, await chargeFor(session))

  await db
    .from('activation_attempts')
    .update({
      checkout_session_id: session.id,
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', attempt.id)
}

// ---------------------------------------------------------------------------
// invoice.paid  (recurring / subscription activation)
// ---------------------------------------------------------------------------
export async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  const invoiceId = invoice.id ?? null
  const subscriptionId = invoiceSubscriptionId(invoice)
  const db = createServiceClient()

  if (invoiceId) {
    const { data: dup } = await db
      .from('payments')
      .select('id')
      .eq('provider_invoice_id', invoiceId)
      .maybeSingle()
    if (dup) return
  }

  const meta = invoice.metadata ?? {}
  const subMeta =
    (invoice as { subscription_details?: { metadata?: Record<string, string> } }).subscription_details
      ?.metadata ?? {}
  const attemptId = subMeta.activation_attempt_id ?? meta.activation_attempt_id
  if (!attemptId) return

  const { data: attempt } = await db
    .from('activation_attempts')
    .select('id, status, plan_id, user_id, billing_mode, owner_xnid, billing_xnid, dealer_xnid, devices:activation_attempt_devices(xnid)')
    .eq('id', Number(attemptId))
    .maybeSingle()
  if (!attempt) return

  const attemptDevices = (attempt.devices as { xnid: string }[] | null) ?? []

  if (attempt.status === 'completed') {
    await recordPayment(db, {
      invoiceId,
      xnid: attempt.owner_xnid ?? attemptDevices[0]?.xnid ?? null,
      amountCents: invoice.amount_paid ?? 0,
      method: 'stripe',
    })
    return
  }

  if (subscriptionId) {
    const { data: existingEnt } = await db
      .from('subscription_entitlements')
      .select('id')
      .eq('provider_subscription_id', subscriptionId)
      .maybeSingle()
    if (existingEnt) {
      await recordPayment(db, {
        invoiceId,
        xnid: attempt.owner_xnid ?? attemptDevices[0]?.xnid ?? null,
        amountCents: invoice.amount_paid ?? 0,
        method: 'stripe',
      })
      return
    }
  }

  const { data: plan } = await db
    .from('plans')
    .select('device_limit')
    .eq('id', attempt.plan_id)
    .maybeSingle()

  const { data: ent } = await db
    .from('subscription_entitlements')
    .insert({
      provider_subscription_id: subscriptionId,
      plan_id: attempt.plan_id,
      user_id: attempt.user_id,
      billing_mode: attempt.billing_mode,
      owner_xnid: attempt.owner_xnid,
      billing_xnid: attempt.billing_xnid,
      dealer_xnid: attempt.dealer_xnid,
      source: 'stripe',
      provider_customer_id: typeof invoice.customer === 'string' ? invoice.customer : null,
      max_devices_allowed: plan?.device_limit ?? null,
      active_device_count: 0,
      status: 'active',
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (!ent) return

  let assigned = 0
  for (const ad of attemptDevices) {
    const { data: elsewhere } = await db
      .from('device_assignments')
      .select('id')
      .eq('xnid', ad.xnid)
      .eq('status', 'active')
      .neq('entitlement_id', ent.id)
      .maybeSingle()
    if (elsewhere) continue

    const { data: ud } = await db
      .from('user_devices')
      .select('id')
      .eq('xnid', ad.xnid)
      .maybeSingle()
    if (!ud) continue

    await db.from('device_assignments').upsert(
      {
        xnid: ad.xnid,
        entitlement_id: ent.id,
        provider_subscription_id: subscriptionId,
        assigned_at: new Date().toISOString(),
        status: 'active',
      },
      { onConflict: 'xnid,entitlement_id' },
    )
    await db
      .from('user_devices')
      .update({
        status: 'captured',
        activation_status: 'activated',
        activated_at: new Date().toISOString(),
        entitlement_id: ent.id,
      })
      .eq('id', ud.id)
    assigned++
  }
  await db.from('subscription_entitlements').update({ active_device_count: assigned }).eq('id', ent.id)

  const payment = await recordPayment(db, {
    invoiceId,
    xnid: attempt.owner_xnid ?? attemptDevices[0]?.xnid ?? null,
    amountCents: invoice.amount_paid ?? 0,
    method: 'stripe',
  })
  if (payment) await recordPaymentDetails(db, payment.id, await chargeFor(invoice as unknown as { charge?: unknown }))

  await db
    .from('activation_attempts')
    .update({
      provider_subscription_id: subscriptionId,
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', attempt.id)
}

// ---------------------------------------------------------------------------
// invoice.payment_failed
// ---------------------------------------------------------------------------
export async function handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const db = createServiceClient()
  const subscriptionId = invoiceSubscriptionId(invoice)
  const subMeta =
    (invoice as { subscription_details?: { metadata?: Record<string, string> } }).subscription_details
      ?.metadata ?? {}
  const attemptId = subMeta.activation_attempt_id ?? invoice.metadata?.activation_attempt_id

  if (subscriptionId) {
    await db
      .from('subscription_entitlements')
      .update({ status: 'past_due' })
      .eq('provider_subscription_id', subscriptionId)
  }
  if (attemptId) {
    await db
      .from('activation_attempts')
      .update({ status: 'failed' })
      .eq('id', Number(attemptId))
      .eq('status', 'pending')
  }
}

// ---------------------------------------------------------------------------
// customer.subscription.deleted
// ---------------------------------------------------------------------------
export async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  const db = createServiceClient()
  const { data: ent } = await db
    .from('subscription_entitlements')
    .select('id')
    .eq('provider_subscription_id', subscription.id)
    .maybeSingle()
  if (!ent) return

  await db
    .from('subscription_entitlements')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('id', ent.id)
  await db
    .from('device_assignments')
    .update({ status: 'suspended' })
    .eq('entitlement_id', ent.id)
}

// ---------------------------------------------------------------------------
// checkout.session.expired
// ---------------------------------------------------------------------------
export async function handleSessionExpired(session: Stripe.Checkout.Session): Promise<void> {
  const attemptId = session.client_reference_id
  if (!attemptId) return
  const db = createServiceClient()

  const { data: attempt } = await db
    .from('activation_attempts')
    .select('id, status, devices:activation_attempt_devices(xnid)')
    .eq('id', Number(attemptId))
    .maybeSingle()
  if (!attempt || attempt.status !== 'pending') return

  const xnids = ((attempt.devices as { xnid: string }[] | null) ?? []).map((d) => d.xnid)
  if (xnids.length > 0) {
    await db
      .from('user_devices')
      .update({ session_id: null })
      .in('xnid', xnids)
      .eq('status', 'decline')
  }
  await db.from('activation_attempts').update({ status: 'expired' }).eq('id', attempt.id)
}
