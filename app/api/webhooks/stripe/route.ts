import { NextResponse } from 'next/server'
import type Stripe from 'stripe'

import { createServiceClient } from '@/utils/supabase/service'
import { getStripe, getWebhookSecret, isStripeConfigured } from '@/lib/billing/stripe'
import {
  handleCheckoutCompleted,
  handleInvoicePaid,
  handlePaymentFailed,
  handleSessionExpired,
  handleSubscriptionDeleted,
} from '@/lib/billing/webhook-handlers'

/**
 * Stripe webhook — `POST /api/webhooks/stripe`
 * (old: `POST /api/stripe/webhook` + web `POST /webhook`).
 *
 * A4: signature verification is KEPT (`constructEventAsync`).
 * Idempotency: `stripe_events.event_id` is unique — a duplicate delivery is a
 * no-op. The event is recorded BEFORE dispatch so a handler crash still marks
 * it seen (matches the old behaviour).
 *
 * Old shape was `{ received: true }` / `{ duplicate: true }` / `{ handled: true }`
 * with 200; a bad signature returned 400. Reproduced.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request): Promise<Response> {
  if (!isStripeConfigured() || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Stripe is not configured' }, { status: 503 })
  }

  const body = await req.text()
  const sig = req.headers.get('stripe-signature')
  if (!sig) return NextResponse.json({ error: 'Missing signature' }, { status: 400 })

  let event: Stripe.Event
  try {
    event = await getStripe().webhooks.constructEventAsync(body, sig, getWebhookSecret())
  } catch (e) {
    console.error('[stripe] invalid webhook signature', (e as Error).message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const db = createServiceClient()

  const { data: seen } = await db
    .from('stripe_events')
    .select('id')
    .eq('event_id', event.id)
    .maybeSingle()
  if (seen) return NextResponse.json({ duplicate: true })

  await db.from('stripe_events').insert({ event_id: event.id, type: event.type })

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
        break
      case 'checkout.session.expired':
        await handleSessionExpired(event.data.object as Stripe.Checkout.Session)
        break
      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice)
        break
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice)
        break
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break
      default:
        // acknowledged, no handler
        break
    }
  } catch (e) {
    console.error(`[stripe] handler for ${event.type} failed`, e)
    // Return 500 so Stripe retries; the event row stays and the next delivery
    // is a no-op if the handler actually succeeded before crashing.
    return NextResponse.json({ error: 'handler_failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
