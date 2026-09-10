'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createClient } from '@/utils/supabase/server'
import { requireAuth, requirePermission } from '@/lib/auth/guards'
import type { Database } from '@/lib/database.types'

/**
 * Mutations for the messaging / notification-config surface:
 * - `notification_prefs` — `POST set/notifications` (auth:api, own row)
 * - `alert_windows` — `NotificationSchedulerController` CRUD (`rulebuilder,*`)
 * - `device_notification_recipients` — `POST update-device/notification/address/{ud}`
 *   (deferred from slice 3)
 */

export interface MessagingResult {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string[]>
  id?: number
}

// ---------------------------------------------------------------------------
// notification_prefs
// ---------------------------------------------------------------------------
const prefSchema = z.object({
  user_device_id: z.coerce.number().int().positive().nullable().optional(),
  email_enabled: z.coerce.boolean().optional().default(false),
  phone_enabled: z.coerce.boolean().optional().default(false),
  customer_phone_enabled: z.coerce.boolean().optional().default(false),
  customer_email_enabled: z.coerce.boolean().optional().default(false),
  manager_phone_enabled: z.coerce.boolean().optional().default(false),
  manager_email_enabled: z.coerce.boolean().optional().default(false),
  device_phone_enabled: z.coerce.boolean().optional().default(false),
  device_email_enabled: z.coerce.boolean().optional().default(false),
})

export async function setNotificationPrefs(input: unknown): Promise<MessagingResult> {
  const actor = await requireAuth()
  const parsed = prefSchema.safeParse(input)
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors }
  const v = parsed.data
  const supabase = await createClient()

  const values: Database['public']['Tables']['notification_prefs']['Update'] = {
    email_enabled: v.email_enabled,
    phone_enabled: v.phone_enabled,
    customer_phone_enabled: v.customer_phone_enabled,
    customer_email_enabled: v.customer_email_enabled,
    manager_phone_enabled: v.manager_phone_enabled,
    manager_email_enabled: v.manager_email_enabled,
    device_phone_enabled: v.device_phone_enabled,
    device_email_enabled: v.device_email_enabled,
  }

  let query = supabase
    .from('notification_prefs')
    .select('id')
    .eq('user_id', actor.id)
  query = v.user_device_id ? query.eq('user_device_id', v.user_device_id) : query.is('user_device_id', null)
  const { data: existing } = await query.limit(1).maybeSingle()

  if (existing) {
    const { error } = await supabase.from('notification_prefs').update(values).eq('id', existing.id)
    if (error) return { ok: false, error: 'Could not save your preferences.' }
  } else {
    const { error } = await supabase
      .from('notification_prefs')
      .insert({ ...values, user_id: actor.id, user_device_id: v.user_device_id ?? null })
    if (error) return { ok: false, error: 'Could not save your preferences.' }
  }
  revalidatePath('/app/messaging')
  return { ok: true }
}

// ---------------------------------------------------------------------------
// alert_windows  (notification schedulers)
// ---------------------------------------------------------------------------
const windowSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  rule_name: z.string().trim().max(191).optional(),
  building_id: z.coerce.number().int().positive().nullable().optional(),
  marina_id: z.coerce.number().int().positive().nullable().optional(),
  company_id: z.coerce.number().int().positive().nullable().optional(),
  attribute_key: z.string().trim().min(1).max(191),
  inventories: z.array(z.object({ value: z.string(), label: z.string() })).optional().default([]),
  days: z.array(z.string().max(10)).optional().default([]),
  recurrence: z.enum(['daily', 'weekly', 'bi-weekly']).default('weekly'),
  start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  timezone: z.string().trim().min(1).default('UTC'),
})

export async function saveAlertWindow(input: unknown): Promise<MessagingResult> {
  const hasId = !!(input && (input as { id?: unknown }).id)
  await requirePermission('rulebuilder', hasId ? 'update' : 'create')
  const parsed = windowSchema.safeParse(input)
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors }
  const v = parsed.data
  const supabase = await createClient()

  const row = {
    rule_name: v.rule_name || null,
    building_id: v.building_id ?? null,
    marina_id: v.marina_id ?? null,
    company_id: v.company_id ?? null,
    attribute_key: v.attribute_key,
    inventories: v.inventories as never,
    days: v.days,
    recurrence: v.recurrence,
    start_time: v.start_time.length === 5 ? `${v.start_time}:00` : v.start_time,
    end_time: v.end_time.length === 5 ? `${v.end_time}:00` : v.end_time,
    timezone: v.timezone,
  }

  if (v.id) {
    const { error } = await supabase.from('alert_windows').update(row).eq('id', v.id)
    if (error) return { ok: false, error: 'Could not update the window.' }
    revalidatePath('/app/messaging')
    return { ok: true, id: v.id }
  }
  const { data, error } = await supabase.from('alert_windows').insert(row).select('id').single()
  if (error || !data) return { ok: false, error: 'Could not create the window.' }
  revalidatePath('/app/messaging')
  return { ok: true, id: data.id }
}

export async function deleteAlertWindow(id: number): Promise<MessagingResult> {
  await requirePermission('rulebuilder', 'delete')
  const supabase = await createClient()
  const { error } = await supabase.from('alert_windows').delete().eq('id', id)
  if (error) return { ok: false, error: 'Could not delete the window.' }
  revalidatePath('/app/messaging')
  return { ok: true }
}

// ---------------------------------------------------------------------------
// device_notification_recipients
// ---------------------------------------------------------------------------
const recipientsSchema = z.object({
  user_device_id: z.coerce.number().int().positive(),
  emails: z.array(z.string().trim()).optional().default([]),
  phone_numbers: z.array(z.string().trim()).optional().default([]),
})

export async function saveDeviceRecipients(input: unknown): Promise<MessagingResult> {
  await requireAuth()
  const parsed = recipientsSchema.safeParse(input)
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors }
  const v = parsed.data
  const supabase = await createClient()

  const { data: owner } = await supabase
    .from('user_devices')
    .select('user_id')
    .eq('id', v.user_device_id)
    .maybeSingle()

  const { error } = await supabase.from('device_notification_recipients').upsert(
    {
      user_device_id: v.user_device_id,
      user_id: owner?.user_id ?? null,
      emails: v.emails.filter(Boolean),
      phone_numbers: v.phone_numbers.filter(Boolean),
    },
    { onConflict: 'user_device_id' },
  )
  if (error) return { ok: false, error: 'Could not save the recipients.' }
  revalidatePath('/app/messaging')
  revalidatePath(`/app/devices/${v.user_device_id}`)
  return { ok: true }
}
