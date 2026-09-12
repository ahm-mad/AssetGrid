import 'server-only'

import Stripe from 'stripe'

/**
 * Stripe client. The secret key + webhook secret are NOT in `.env` yet — the
 * user still owes `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`. Until then
 * `isStripeConfigured()` is false and any code path that needs Stripe returns a
 * clear "not configured" error instead of crashing, so the rest of the slice
 * builds and runs.
 */

export class StripeNotConfiguredError extends Error {
  constructor() {
    super('Stripe is not configured — set STRIPE_SECRET_KEY (and STRIPE_WEBHOOK_SECRET).')
    this.name = 'StripeNotConfiguredError'
  }
}

let cached: Stripe | null = null

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY
}

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new StripeNotConfiguredError()
  if (!cached) {
    cached = new Stripe(key, { appInfo: { name: 'assetgrid' } })
  }
  return cached
}

export function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) throw new StripeNotConfiguredError()
  return secret
}

/** The public site URL Stripe redirects back to (checkout success / cancel). */
export function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    'http://localhost:3000'
  ).replace(/\/$/, '')
}
