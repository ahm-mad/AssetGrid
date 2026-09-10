import 'server-only'

import { createServiceClient } from '@/utils/supabase/service'

/**
 * The messaging audit outbox (ADR-036). Every outbound SMS / email writes a
 * `message_outbox` row: `mocked` when the provider is unconfigured (nothing is
 * actually sent), `sent` / `failed` when it is. Lets the user see exactly what
 * the system would deliver before any Twilio / Resend credentials exist.
 */

export interface OutboxEntry {
  channel: 'sms' | 'email'
  toAddress: string
  fromAddress?: string | null
  subject?: string | null
  body: string
  context?: Record<string, unknown> | null
  status: 'mocked' | 'sent' | 'failed'
  provider?: string | null
  providerId?: string | null
  error?: string | null
}

export async function recordOutbox(entry: OutboxEntry): Promise<void> {
  try {
    const db = createServiceClient()
    await db.from('message_outbox').insert({
      channel: entry.channel,
      to_address: entry.toAddress,
      from_address: entry.fromAddress ?? null,
      subject: entry.subject ?? null,
      body: entry.body,
      context: (entry.context ?? null) as never,
      status: entry.status,
      provider: entry.provider ?? null,
      provider_id: entry.providerId ?? null,
      error: entry.error ?? null,
    })
  } catch (e) {
    console.warn('[outbox] failed to record message', (e as Error).message)
  }
}
