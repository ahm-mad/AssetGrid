import 'server-only'

import { createHmac, timingSafeEqual } from 'node:crypto'

import { createServiceClient } from '@/utils/supabase/service'
import { sendSms } from '@/lib/notify/sms'

/**
 * Inbound SMS handling — ports `TwilioController@handleTwilioWebhook` +
 * `@handleJoin` / `@handleStop` / `@broadcastAdminMessage`. The `To` number
 * resolves a group; a message from the group's admin number is broadcast to
 * every member, otherwise `JOIN` / `STOP` subscribe / unsubscribe the sender.
 *
 * `verifyTwilioSignature` implements the A7 check the old app never did
 * (`X-Twilio-Signature` = base64 HMAC-SHA1 of the full URL + sorted POST params,
 * keyed by the auth token). Skipped when `TWILIO_TOKEN` is unset (dev).
 */

export function verifyTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string | null,
): boolean {
  const token = process.env.TWILIO_TOKEN
  if (!token) return true // dev — no token, no verification (matches the sensor-HMAC pattern)
  if (!signature) return false

  const data =
    url +
    Object.keys(params)
      .sort()
      .map((k) => k + params[k])
      .join('')
  const expected = createHmac('sha1', token).update(data).digest('base64')
  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  return a.length === b.length && timingSafeEqual(a, b)
}

export interface InboundResult {
  reply?: string // TwiML message body to send back
  status: 'broadcast' | 'joined' | 'already_subscribed' | 'stopped' | 'not_subscribed' | 'help' | 'no_group'
}

export async function handleInboundSms(input: {
  from: string
  to: string
  body: string
}): Promise<InboundResult> {
  const db = createServiceClient()
  const from = input.from.trim()
  const to = input.to.trim()
  const body = input.body.trim()

  const { data: group } = await db
    .from('sms_groups')
    .select('id, group_name, admin_number, group_assigned_num')
    .eq('group_assigned_num', to)
    .maybeSingle()
  if (!group) return { status: 'no_group', reply: 'This number is not configured for any group.' }

  // admin → broadcast
  if (group.admin_number && from === group.admin_number) {
    const { data: members } = await db
      .from('sms_group_registers')
      .select('phone')
      .eq('group_id', group.id)
    await db.from('sms_group_broadcast_messages').insert({
      group_id: group.id,
      topic: `Group ${group.group_name}`,
      message: body,
      phone: from,
    })
    for (const m of members ?? []) {
      await sendSms(m.phone, body, {
        from: group.group_assigned_num,
        context: { source: 'inbound_admin_broadcast', group_id: group.id },
      })
    }
    return { status: 'broadcast', reply: `Message broadcasted to ${group.group_name}` }
  }

  const cmd = body.toLowerCase()

  if (cmd.startsWith('join')) {
    const { data: existing } = await db
      .from('sms_group_registers')
      .select('id')
      .eq('group_id', group.id)
      .eq('phone', from)
      .maybeSingle()
    if (existing) {
      await replyViaGroup(db, group, from, "You're already subscribed to this group.")
      return { status: 'already_subscribed' }
    }
    await db.from('sms_group_registers').insert({ group_id: group.id, phone: from })
    await syncRegId(db, group.id)
    await replyViaGroup(
      db,
      group,
      from,
      `Thank you for joining ${group.group_name}. You'll now receive messages from this group. Reply STOP to unsubscribe.`,
    )
    return { status: 'joined' }
  }

  if (cmd.startsWith('stop')) {
    const { data: reg } = await db
      .from('sms_group_registers')
      .select('id')
      .eq('group_id', group.id)
      .eq('phone', from)
      .maybeSingle()
    if (!reg) return { status: 'not_subscribed' }
    await db.from('sms_group_registers').delete().eq('id', reg.id)
    await syncRegId(db, group.id)
    await replyViaGroup(db, group, from, 'You have been unsubscribed from this group.')
    return { status: 'stopped' }
  }

  return { status: 'help', reply: "Send 'JOIN' to subscribe or 'STOP' to unsubscribe." }
}

async function replyViaGroup(
  db: ReturnType<typeof createServiceClient>,
  group: { group_assigned_num: string; id: number },
  to: string,
  message: string,
): Promise<void> {
  await sendSms(to, message, {
    from: group.group_assigned_num,
    context: { source: 'inbound_reply', group_id: group.id },
  })
}

async function syncRegId(
  db: ReturnType<typeof createServiceClient>,
  groupId: number,
): Promise<void> {
  const { data } = await db.from('sms_group_registers').select('id').eq('group_id', groupId).order('id')
  await db
    .from('sms_groups')
    .update({ reg_id: (data ?? []).map((r) => r.id).join(':') || null })
    .eq('id', groupId)
}
