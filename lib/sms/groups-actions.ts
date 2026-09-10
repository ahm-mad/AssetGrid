'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createServiceClient } from '@/utils/supabase/service'
import { requirePermission } from '@/lib/auth/guards'
import { sendSms } from '@/lib/notify/sms'

/**
 * SMS-groups mutations — ports `TwilioController@adminBulkSubscribeToGroup` /
 * `@updateGroup` / `@deleteGroup` / `@adminUnsubscribeUser` /
 * `@handleAdminBroadcast`. Perm: `messaging,{create|update|delete}` (the old
 * routes were **entirely public** — A3). Outbound SMS goes through
 * `lib/notify/sms.ts` → the mock outbox until Twilio is configured (ADR-036).
 */

export interface SmsResult<T = undefined> {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string[]>
  data?: T
}

const REVALIDATE = () => revalidatePath('/app/messaging')

function normalisePhone(raw: string): string {
  const p = raw.replace(/[^0-9+]/g, '')
  return p.startsWith('+') ? p : `+${p}`
}

function parseNumbers(csv: string | null | undefined): string[] {
  if (!csv) return []
  return [...new Set(csv.split(',').map((n) => n.trim()).filter(Boolean).map(normalisePhone))]
}

/** Keep the legacy `reg_id` `:`-joined id string in sync with the actual members. */
async function syncRegId(db: ReturnType<typeof createServiceClient>, groupId: number): Promise<void> {
  const { data } = await db.from('sms_group_registers').select('id').eq('group_id', groupId).order('id')
  await db
    .from('sms_groups')
    .update({ reg_id: (data ?? []).map((r) => r.id).join(':') || null })
    .eq('id', groupId)
}

// ---------------------------------------------------------------------------
const createGroupSchema = z.object({
  group_name: z.string().trim().min(1).max(191),
  group_number: z.string().trim().min(1).max(191),
  admin_id: z.string().uuid(),
  admin_phone: z.string().trim().min(1).max(191),
  topic: z.string().trim().max(191).nullable().optional(),
  user_numbers: z.string().trim().nullable().optional(),
})

/** `@adminBulkSubscribeToGroup` — create/find a group + bulk-subscribe numbers. */
export async function createSmsGroup(input: unknown): Promise<SmsResult<{ groupId: number; subscribed: number }>> {
  const actor = await requirePermission('messaging', 'create')
  const parsed = createGroupSchema.safeParse(input)
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors }
  const v = parsed.data
  const db = createServiceClient()

  const { data: existing } = await db
    .from('sms_groups')
    .select('id, group_name')
    .eq('group_assigned_num', v.group_number)
    .maybeSingle()

  let groupId: number
  let groupName: string
  if (existing) {
    groupId = existing.id
    groupName = existing.group_name
  } else {
    const { data, error } = await db
      .from('sms_groups')
      .insert({
        group_name: v.group_name,
        group_assigned_num: v.group_number,
        admin_number: normalisePhone(v.admin_phone),
        admin_id: v.admin_id,
        company_id: actor.companyId,
        topic: v.topic ?? null,
      })
      .select('id, group_name')
      .single()
    if (error || !data) return { ok: false, error: 'Could not create the group (number already used?).' }
    groupId = data.id
    groupName = data.group_name
  }

  let subscribed = 0
  const numbers = parseNumbers(v.user_numbers)
  if (numbers.length > 0) {
    const { data: have } = await db
      .from('sms_group_registers')
      .select('phone')
      .eq('group_id', groupId)
    const haveSet = new Set((have ?? []).map((r) => r.phone))
    const toAdd = numbers.filter((n) => !haveSet.has(n))
    if (toAdd.length > 0) {
      await db.from('sms_group_registers').insert(toAdd.map((phone) => ({ group_id: groupId, phone })))
      subscribed = toAdd.length
    }
    await syncRegId(db, groupId)
    for (const phone of toAdd) {
      await sendSms(
        phone,
        `You've been added to group '${groupName}'. Reply STOP to unsubscribe.`,
        { from: v.group_number, context: { source: 'group_add', group_id: groupId } },
      )
    }
  }

  REVALIDATE()
  return { ok: true, data: { groupId, subscribed } }
}

const updateGroupSchema = z.object({
  id: z.coerce.number().int().positive(),
  group_name: z.string().trim().min(1).max(191).optional(),
  group_number: z.string().trim().min(1).max(191).optional(),
  admin_phone: z.string().trim().min(1).max(191).optional(),
  topic: z.string().trim().max(191).nullable().optional(),
  user_numbers: z.string().trim().nullable().optional(),
})

/** `@updateGroup` — patch group info + reconcile the member list. */
export async function updateSmsGroup(input: unknown): Promise<SmsResult> {
  await requirePermission('messaging', 'update')
  const parsed = updateGroupSchema.safeParse(input)
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors }
  const v = parsed.data
  const db = createServiceClient()

  const patch: { group_name?: string; group_assigned_num?: string; admin_number?: string; topic?: string | null } = {}
  if (v.group_name !== undefined) patch.group_name = v.group_name
  if (v.group_number !== undefined) patch.group_assigned_num = v.group_number
  if (v.admin_phone !== undefined) patch.admin_number = normalisePhone(v.admin_phone)
  if (v.topic !== undefined) patch.topic = v.topic
  if (Object.keys(patch).length > 0) {
    const { error } = await db.from('sms_groups').update(patch).eq('id', v.id)
    if (error) return { ok: false, error: 'Could not update the group (number already used?).' }
  }

  if (v.user_numbers !== undefined) {
    const phones = parseNumbers(v.user_numbers)
    const { data: existing } = await db.from('sms_group_registers').select('phone').eq('group_id', v.id)
    const existingSet = new Set((existing ?? []).map((r) => r.phone))
    const wantSet = new Set(phones)

    const toRemove = [...existingSet].filter((p) => !wantSet.has(p))
    const toAdd = [...wantSet].filter((p) => !existingSet.has(p))
    if (toRemove.length > 0)
      await db.from('sms_group_registers').delete().eq('group_id', v.id).in('phone', toRemove)
    if (toAdd.length > 0)
      await db.from('sms_group_registers').insert(toAdd.map((phone) => ({ group_id: v.id, phone })))
    await syncRegId(db, v.id)
  }

  REVALIDATE()
  return { ok: true }
}

export async function deleteSmsGroup(id: number): Promise<SmsResult> {
  await requirePermission('messaging', 'delete')
  const db = createServiceClient()
  const { error } = await db.from('sms_groups').delete().eq('id', id) // registers cascade
  if (error) return { ok: false, error: 'Could not delete the group.' }
  REVALIDATE()
  return { ok: true }
}

/** `@adminUnsubscribeUser`. */
export async function unsubscribeFromGroup(groupId: number, phone: string): Promise<SmsResult> {
  await requirePermission('messaging', 'update')
  const db = createServiceClient()
  const { data: reg } = await db
    .from('sms_group_registers')
    .select('id')
    .eq('group_id', groupId)
    .eq('phone', normalisePhone(phone))
    .maybeSingle()
  if (!reg) return { ok: false, error: 'That number is not in the group.' }
  await db.from('sms_group_registers').delete().eq('id', reg.id)
  await syncRegId(db, groupId)
  REVALIDATE()
  return { ok: true }
}

/** `@handleAdminBroadcast` — admin sends a message to every group member. */
export async function adminBroadcast(input: {
  groupId: number
  message: string
}): Promise<SmsResult<{ recipients: number }>> {
  await requirePermission('messaging', 'create')
  const message = String(input.message ?? '').trim()
  if (!message) return { ok: false, error: 'A message is required.' }
  const db = createServiceClient()

  const { data: group } = await db
    .from('sms_groups')
    .select('id, group_name, group_assigned_num, admin_number')
    .eq('id', input.groupId)
    .maybeSingle()
  if (!group) return { ok: false, error: 'Group not found.' }

  const { data: members } = await db
    .from('sms_group_registers')
    .select('phone')
    .eq('group_id', group.id)
  const recipients = (members ?? []).map((m) => m.phone)

  await db.from('sms_group_broadcast_messages').insert({
    group_id: group.id,
    topic: `Group ${group.group_name}`,
    message,
    phone: group.admin_number ?? group.group_assigned_num,
  })

  for (const to of recipients) {
    await sendSms(to, message, {
      from: group.group_assigned_num,
      context: { source: 'admin_broadcast', group_id: group.id },
    })
  }

  REVALIDATE()
  return { ok: true, data: { recipients: recipients.length } }
}

/** `@send` — ad-hoc SMS to one or more numbers. */
export async function sendAdHocSms(input: {
  to: string | string[]
  message: string
}): Promise<SmsResult<{ sent: number }>> {
  await requirePermission('messaging', 'create')
  const message = String(input.message ?? '').trim()
  if (!message || message.length > 1600) return { ok: false, error: 'Message must be 1–1600 characters.' }
  const numbers = (Array.isArray(input.to) ? input.to : [input.to]).map(normalisePhone).filter(Boolean)
  if (numbers.length === 0) return { ok: false, error: 'At least one recipient is required.' }
  for (const to of numbers) await sendSms(to, message, { context: { source: 'ad_hoc' } })
  return { ok: true, data: { sent: numbers.length } }
}
