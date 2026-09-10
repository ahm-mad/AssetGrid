import 'server-only'

/**
 * Transactional email via Resend (ADR-030). Gated on `RESEND_API_KEY` — when it
 * is absent every send is a logged no-op so the app builds/runs without it.
 * The `resend` npm package is NOT a dependency yet; we call the REST API with
 * `fetch` to avoid pulling it in before the user commits to the provider.
 */

export function isMailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY
}

export interface MailMessage {
  to: string | string[]
  subject: string
  text: string
  html?: string
}

export async function sendMail(msg: MailMessage): Promise<{ ok: boolean; id?: string; error?: string }> {
  const key = process.env.RESEND_API_KEY
  const from = process.env.MAIL_FROM ?? 'alerts@armitalerts.com'
  const fromName = process.env.MAIL_FROM_NAME ?? 'ARMIT Alerts'

  if (!key) {
    console.warn(`[mail] RESEND_API_KEY not set — skipping "${msg.subject}" to ${JSON.stringify(msg.to)}`)
    return { ok: true }
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: `${fromName} <${from}>`,
        to: Array.isArray(msg.to) ? msg.to : [msg.to],
        subject: msg.subject,
        text: msg.text,
        ...(msg.html ? { html: msg.html } : {}),
      }),
    })
    if (!res.ok) return { ok: false, error: `resend ${res.status}: ${await res.text()}` }
    const data = (await res.json()) as { id?: string }
    return { ok: true, id: data.id }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}
