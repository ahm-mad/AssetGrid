import { NextResponse } from 'next/server'

import { verifyTwilioSignature, handleInboundSms } from '@/lib/sms/webhook'

/**
 * `POST /api/twilio-webhook` — `TwilioController@handleTwilioWebhook`. The one
 * genuinely public route in the SMS surface (Twilio posts inbound messages
 * here). **Verifies `X-Twilio-Signature`** (A7 — the old app did not). Replies
 * with TwiML.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function twiml(message: string): Response {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')}</Message></Response>`
  return new NextResponse(xml, { status: 200, headers: { 'content-type': 'text/xml' } })
}

export async function POST(req: Request): Promise<Response> {
  const form = await req.formData()
  const params: Record<string, string> = {}
  for (const [k, v] of form.entries()) if (typeof v === 'string') params[k] = v

  const url = process.env.TWILIO_WEBHOOK_URL ?? new URL(req.url).toString()
  if (!verifyTwilioSignature(url, params, req.headers.get('x-twilio-signature'))) {
    return NextResponse.json({ message: 'Invalid signature' }, { status: 403 })
  }

  const from = params.From
  const to = params.To
  const body = (params.Body ?? '').trim()
  if (!from || !to || !body) {
    return NextResponse.json({ message: 'Invalid request' }, { status: 400 })
  }

  const result = await handleInboundSms({ from, to, body })
  if (result.reply) return twiml(result.reply)
  return NextResponse.json({ status: result.status }, { status: 200 })
}
