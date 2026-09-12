import 'server-only'

import { recordOutbox } from '@/lib/notify/outbox'

/**
 * Transactional email via Resend (ADR-030). Gated on `RESEND_API_KEY` — when it
 * is absent every send is a **mock**: a `message_outbox` row (status `mocked`)
 * is written and nothing leaves the system (ADR-036). When configured the
 * Resend REST API is called and the row is `sent` / `failed`. The `resend` npm
 * package is not a dependency — we call the REST API with `fetch`.
 */

export function isMailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY
}

export interface MailAttachment {
  filename: string
  /** base64-encoded file content */
  content: string
}

export interface MailMessage {
  to: string | string[]
  subject: string
  text: string
  html?: string
  attachments?: MailAttachment[]
  context?: Record<string, unknown>
}

export async function sendMail(msg: MailMessage): Promise<{ ok: boolean; id?: string; error?: string }> {
  const key = process.env.RESEND_API_KEY
  const from = process.env.MAIL_FROM ?? 'alerts@assetgrid.example'
  const fromName = process.env.MAIL_FROM_NAME ?? 'AssetGrid Alerts'
  const recipients = Array.isArray(msg.to) ? msg.to : [msg.to]

  const audit = (status: 'mocked' | 'sent' | 'failed', extra: { providerId?: string; error?: string } = {}) =>
    Promise.all(
      recipients.map((to) =>
        recordOutbox({
          channel: 'email',
          toAddress: to,
          fromAddress: `${fromName} <${from}>`,
          subject: msg.subject,
          body: msg.text,
          context: msg.context,
          status,
          provider: 'resend',
          providerId: extra.providerId,
          error: extra.error,
        }),
      ),
    )

  if (!key) {
    console.warn(`[mail] RESEND_API_KEY not set — mocking "${msg.subject}" to ${JSON.stringify(msg.to)}`)
    await audit('mocked')
    return { ok: true }
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: `${fromName} <${from}>`,
        to: recipients,
        subject: msg.subject,
        text: msg.text,
        ...(msg.html ? { html: msg.html } : {}),
        ...(msg.attachments?.length ? { attachments: msg.attachments } : {}),
      }),
    })
    if (!res.ok) {
      const error = `resend ${res.status}: ${await res.text()}`
      await audit('failed', { error })
      return { ok: false, error }
    }
    const data = (await res.json()) as { id?: string }
    await audit('sent', { providerId: data.id })
    return { ok: true, id: data.id }
  } catch (e) {
    const error = (e as Error).message
    await audit('failed', { error })
    return { ok: false, error }
  }
}
