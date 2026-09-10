import 'server-only'

import { isSmsConfigured } from '@/lib/notify/sms'

/**
 * Twilio phone-number / message management — ports the read side of
 * `TwilioController` (`twilio/numbers`, `.../details`, `.../incoming`,
 * `.../outgoing`, `.../messages`, `.../stats`, `webhook-logs`,
 * `PUT .../webhooks`). These are pure Twilio-REST passthroughs; when Twilio is
 * unconfigured (the normal state — ADR-036) each returns
 * `{ configured: false }` and the route answers 200 with that.
 */

const BASE = 'https://api.twilio.com/2010-04-01'

function auth(): string {
  return `Basic ${Buffer.from(`${process.env.TWILIO_SID}:${process.env.TWILIO_TOKEN}`).toString('base64')}`
}

async function twilioGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}/Accounts/${process.env.TWILIO_SID}${path}`, {
    headers: { authorization: auth() },
  })
  if (!res.ok) throw new Error(`twilio ${res.status}: ${await res.text()}`)
  return (await res.json()) as T
}

export interface NotConfigured {
  configured: false
  message: string
}
const NOT_CONFIGURED: NotConfigured = {
  configured: false,
  message: 'Twilio is not configured — number management is unavailable (ADR-036).',
}

export async function listPhoneNumbers(): Promise<
  NotConfigured | { configured: true; numbers: unknown[] }
> {
  if (!isSmsConfigured()) return NOT_CONFIGURED
  const data = await twilioGet<{ incoming_phone_numbers?: unknown[] }>('/IncomingPhoneNumbers.json')
  return { configured: true, numbers: data.incoming_phone_numbers ?? [] }
}

export async function getPhoneNumberDetails(
  phoneNumber: string,
): Promise<NotConfigured | { configured: true; number: unknown }> {
  if (!isSmsConfigured()) return NOT_CONFIGURED
  const data = await twilioGet<{ incoming_phone_numbers?: unknown[] }>(
    `/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(phoneNumber)}`,
  )
  return { configured: true, number: (data.incoming_phone_numbers ?? [])[0] ?? null }
}

export async function listMessages(
  phoneNumber: string,
  direction: 'inbound' | 'outbound' | 'all',
): Promise<NotConfigured | { configured: true; messages: unknown[] }> {
  if (!isSmsConfigured()) return NOT_CONFIGURED
  const key = direction === 'inbound' ? 'To' : direction === 'outbound' ? 'From' : null
  const q = key ? `?${key}=${encodeURIComponent(phoneNumber)}&PageSize=100` : '?PageSize=100'
  const data = await twilioGet<{ messages?: unknown[] }>(`/Messages.json${q}`)
  return { configured: true, messages: data.messages ?? [] }
}

export async function getMessageStats(
  phoneNumber: string,
): Promise<NotConfigured | { configured: true; stats: Record<string, number> }> {
  if (!isSmsConfigured()) return NOT_CONFIGURED
  const data = await twilioGet<{ messages?: { status?: string; direction?: string }[] }>(
    `/Messages.json?To=${encodeURIComponent(phoneNumber)}&PageSize=1000`,
  )
  const stats: Record<string, number> = { total: 0 }
  for (const m of data.messages ?? []) {
    stats.total += 1
    if (m.status) stats[m.status] = (stats[m.status] ?? 0) + 1
    if (m.direction) stats[m.direction] = (stats[m.direction] ?? 0) + 1
  }
  return { configured: true, stats }
}

export async function getWebhookLogs(): Promise<
  NotConfigured | { configured: true; alerts: unknown[] }
> {
  if (!isSmsConfigured()) return NOT_CONFIGURED
  const res = await fetch('https://monitor.twilio.com/v1/Alerts?PageSize=50', {
    headers: { authorization: auth() },
  })
  if (!res.ok) throw new Error(`twilio ${res.status}`)
  const data = (await res.json()) as { alerts?: { alert_text?: string }[] }
  const alerts = (data.alerts ?? [])
    .filter((a) => /webhook|http/i.test(a.alert_text ?? ''))
    .slice(0, 10)
  return { configured: true, alerts }
}

export async function updatePhoneNumberWebhooks(
  sid: string,
  patch: { sms_url?: string; voice_url?: string },
): Promise<NotConfigured | { configured: true; ok: true }> {
  if (!isSmsConfigured()) return NOT_CONFIGURED
  const body = new URLSearchParams()
  if (patch.sms_url) body.set('SmsUrl', patch.sms_url)
  if (patch.voice_url) body.set('VoiceUrl', patch.voice_url)
  const res = await fetch(
    `${BASE}/Accounts/${process.env.TWILIO_SID}/IncomingPhoneNumbers/${sid}.json`,
    { method: 'POST', headers: { authorization: auth(), 'content-type': 'application/x-www-form-urlencoded' }, body },
  )
  if (!res.ok) throw new Error(`twilio ${res.status}: ${await res.text()}`)
  return { configured: true, ok: true }
}
