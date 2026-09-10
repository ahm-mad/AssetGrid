import 'server-only'

/**
 * Outbound SMS via Twilio. Gated on `TWILIO_SID` / `TWILIO_TOKEN` / `TWILIO_FROM`
 * — when any is missing the send is a logged no-op. Calls the Twilio REST API
 * with `fetch` (the `twilio` npm package is added when the Twilio slice /
 * integrations phase lands).
 *
 * Callers: the alert engine (`lib/alerts/`) and the charging control flows
 * ("Charging Started/Stopped").
 */

export function isSmsConfigured(): boolean {
  return !!(process.env.TWILIO_SID && process.env.TWILIO_TOKEN && process.env.TWILIO_FROM)
}

export async function sendSms(
  to: string,
  body: string,
): Promise<{ ok: boolean; sid?: string; error?: string }> {
  const sid = process.env.TWILIO_SID
  const token = process.env.TWILIO_TOKEN
  const from = process.env.TWILIO_FROM

  if (!sid || !token || !from) {
    console.warn(`[sms] Twilio not configured — skipping SMS to ${to}`)
    return { ok: true }
  }

  const to_ = to.startsWith('+') ? to : `+${to}`
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to_, From: from, Body: body }),
    })
    if (!res.ok) return { ok: false, error: `twilio ${res.status}: ${await res.text()}` }
    const data = (await res.json()) as { sid?: string }
    return { ok: true, sid: data.sid }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}
