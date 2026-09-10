import 'server-only'

import { recordOutbox } from './outbox'

/**
 * Outbound SMS via Twilio. Gated on `TWILIO_SID` / `TWILIO_TOKEN` / `TWILIO_FROM`
 * — when any is missing the send is a **mock**: a `message_outbox` row is
 * written with status `mocked` and nothing leaves the system (ADR-036). When
 * configured the Twilio REST API is called and the row is `sent` / `failed`.
 *
 * Callers: the alert engine (`lib/alerts/`), the charging control flows, and
 * the SMS-groups feature (`lib/sms/`).
 */

export function isSmsConfigured(): boolean {
  return !!(process.env.TWILIO_SID && process.env.TWILIO_TOKEN && process.env.TWILIO_FROM)
}

export interface SmsResult {
  ok: boolean
  sid?: string
  mocked?: boolean
  error?: string
}

export async function sendSms(
  to: string,
  body: string,
  opts: { from?: string; context?: Record<string, unknown> } = {},
): Promise<SmsResult> {
  const sid = process.env.TWILIO_SID
  const token = process.env.TWILIO_TOKEN
  const from = opts.from ?? process.env.TWILIO_FROM
  const to_ = to.startsWith('+') ? to : `+${to}`

  if (!sid || !token || !from) {
    console.warn(`[sms] Twilio not configured — mocking SMS to ${to_}: ${body.slice(0, 80)}`)
    await recordOutbox({
      channel: 'sms',
      toAddress: to_,
      fromAddress: from ?? null,
      body,
      context: opts.context,
      status: 'mocked',
      provider: 'twilio',
    })
    return { ok: true, mocked: true }
  }

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to_, From: from, Body: body }),
    })
    if (!res.ok) {
      const error = `twilio ${res.status}: ${await res.text()}`
      await recordOutbox({
        channel: 'sms',
        toAddress: to_,
        fromAddress: from,
        body,
        context: opts.context,
        status: 'failed',
        provider: 'twilio',
        error,
      })
      return { ok: false, error }
    }
    const data = (await res.json()) as { sid?: string }
    await recordOutbox({
      channel: 'sms',
      toAddress: to_,
      fromAddress: from,
      body,
      context: opts.context,
      status: 'sent',
      provider: 'twilio',
      providerId: data.sid ?? null,
    })
    return { ok: true, sid: data.sid }
  } catch (e) {
    const error = (e as Error).message
    await recordOutbox({
      channel: 'sms',
      toAddress: to_,
      fromAddress: from,
      body,
      context: opts.context,
      status: 'failed',
      provider: 'twilio',
      error,
    })
    return { ok: false, error }
  }
}
