'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createClient } from '@/utils/supabase/server'
import { requireAuth, requirePermission } from '@/lib/auth/guards'

/**
 * Inventory mutations — ports `ContainerController` (store / updateInventoryDevice
 * / delete), `SafeGuardConfigurationController`, `DeviceHealthSchedulerController`.
 *
 * - inventory devices: `permission:inventory,create|update|delete`; RLS also
 *   requires the row to be in the actor's `inventory` data-scope.
 * - LoRaWAN secrets (`inventory_device_secrets`) are written separately and
 *   only when the actor is Super Admin or an Admin with `inventory` update
 *   (RLS enforces this too — A10 / ADR-025).
 * - safeguard configs: `permission:rulebuilder,*`.
 * - device-health schedulers: `permission:messaging,*` (a user manages their own).
 */

export interface InventoryResult {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string[]>
  id?: number
}

// ---------------------------------------------------------------------------
// Containers
// ---------------------------------------------------------------------------
export async function saveContainer(input: { id?: number; code: string }): Promise<InventoryResult> {
  await requirePermission('inventory', input.id ? 'update' : 'create')
  const code = String(input.code ?? '').trim()
  if (!code || code.length > 255) return { ok: false, error: 'A container code is required.' }
  const supabase = await createClient()
  if (input.id) {
    const { error } = await supabase.from('containers').update({ code }).eq('id', input.id)
    if (error) return { ok: false, error: 'Could not update the container (code already used?).' }
  } else {
    const { error } = await supabase.from('containers').insert({ code })
    if (error) return { ok: false, error: 'Could not create the container (code already used?).' }
  }
  revalidatePath('/app/inventory/containers')
  return { ok: true }
}

export async function deleteContainer(id: number): Promise<InventoryResult> {
  await requirePermission('inventory', 'delete')
  const supabase = await createClient()
  const { error } = await supabase.from('containers').delete().eq('id', id)
  if (error) return { ok: false, error: 'Could not delete (inventory devices still reference it).' }
  revalidatePath('/app/inventory/containers')
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Inventory devices (+ secrets)
// ---------------------------------------------------------------------------
const secretsShape = {
  app_key: z.string().trim().max(255).optional(),
  app_eui: z.string().trim().max(255).optional(),
  dev_addr: z.string().trim().max(255).optional(),
  nwkskey: z.string().trim().max(255).optional(),
  appskey: z.string().trim().max(255).optional(),
}

const inventoryDeviceSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(2000).optional().default(''),
  activation_code: z.string().trim().max(255).optional().default(''),
  dev_eui: z.string().trim().min(1).max(255),
  container_id: z.coerce.number().int().positive(),
  product_id: z.coerce.number().int().positive(),
  device_type_id: z.union([z.coerce.number().int().positive(), z.literal(''), z.null()]).optional(),
  company_id: z.union([z.coerce.number().int().positive(), z.literal(''), z.null()]).optional(),
  xnid: z.string().trim().max(255).optional().default(''),
  t_code: z.string().trim().max(255).optional().default(''),
  serial_number: z.string().trim().max(255).optional().default(''),
  part_number: z.string().trim().max(255).optional().default(''),
  ...secretsShape,
})

function nullableId(v: number | '' | null | undefined): number | null {
  return v === '' || v == null ? null : Number(v)
}

export async function saveInventoryDevice(input: unknown): Promise<InventoryResult> {
  const hasId = !!(input && (input as { id?: unknown }).id)
  const actor = await requirePermission('inventory', hasId ? 'update' : 'create')
  const parsed = inventoryDeviceSchema.safeParse(input)
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors }
  const v = parsed.data
  const supabase = await createClient()

  const row = {
    name: v.name,
    description: v.description || null,
    activation_code: v.activation_code || null,
    dev_eui: v.dev_eui,
    container_id: v.container_id,
    product_id: v.product_id,
    device_type_id: nullableId(v.device_type_id),
    company_id: nullableId(v.company_id),
    xnid: v.xnid || null,
    t_code: v.t_code || null,
    serial_number: v.serial_number || null,
    part_number: v.part_number || null,
  }

  let deviceId = v.id ?? null
  if (v.id) {
    const { error } = await supabase.from('inventory_devices').update(row).eq('id', v.id)
    if (error) return { ok: false, error: 'Could not update (dev EUI / activation code already used?).' }
  } else {
    const { data, error } = await supabase
      .from('inventory_devices')
      .insert(row)
      .select('id')
      .single()
    if (error || !data)
      return { ok: false, error: 'Could not create (dev EUI / activation code already used?).' }
    deviceId = data.id
  }

  // Secrets — only if the actor can and any value was supplied.
  const canSecrets = actor.isSuperAdmin || actor.roleTitle === 'Admin'
  const anySecret = [v.app_key, v.app_eui, v.dev_addr, v.nwkskey, v.appskey].some((s) => s)
  if (deviceId && canSecrets && anySecret) {
    const secretRow = {
      inventory_device_id: deviceId,
      app_key: v.app_key || null,
      app_eui: v.app_eui || null,
      dev_addr: v.dev_addr || null,
      nwkskey: v.nwkskey || null,
      appskey: v.appskey || null,
    }
    const { error } = await supabase
      .from('inventory_device_secrets')
      .upsert(secretRow, { onConflict: 'inventory_device_id' })
    if (error) return { ok: false, error: 'The device was saved but its keys could not be stored.' }
  }

  revalidatePath('/app/inventory')
  if (deviceId) revalidatePath(`/app/inventory/${deviceId}`)
  return { ok: true, id: deviceId ?? undefined }
}

export async function deleteInventoryDevice(id: number): Promise<InventoryResult> {
  await requirePermission('inventory', 'delete')
  const supabase = await createClient()
  const { error } = await supabase.from('inventory_devices').delete().eq('id', id)
  if (error) return { ok: false, error: 'Could not delete (a device is claimed against it?).' }
  revalidatePath('/app/inventory')
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Safeguard configurations  (rulebuilder module)
// ---------------------------------------------------------------------------
const safeguardSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  user_id: z.string().uuid().nullable().optional(),
  inventory_device_id: z.coerce.number().int().positive().nullable().optional(),
  user_device_id: z.coerce.number().int().positive().nullable().optional(),
  abnormal_alert_limit: z.coerce.number().int().nonnegative().optional().default(3),
  alert_interval_hours: z.coerce.number().nonnegative().optional().default(24),
  support_email_sent: z.array(z.string()).optional().default([]),
  support_number_sent: z.array(z.string()).optional().default([]),
  is_active: z.coerce.boolean().optional().default(true),
  notifications_paused: z.coerce.boolean().optional().default(false),
})

export async function saveSafeguardConfiguration(input: unknown): Promise<InventoryResult> {
  const hasId = !!(input && (input as { id?: unknown }).id)
  await requirePermission('rulebuilder', hasId ? 'update' : 'create')
  const parsed = safeguardSchema.safeParse(input)
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors }
  const v = parsed.data
  const supabase = await createClient()

  const row = {
    user_id: v.user_id ?? null,
    inventory_device_id: v.inventory_device_id ?? null,
    user_device_id: v.user_device_id ?? null,
    abnormal_alert_limit: v.abnormal_alert_limit,
    alert_interval_hours: v.alert_interval_hours,
    support_email_sent: v.support_email_sent,
    support_number_sent: v.support_number_sent,
    is_active: v.is_active,
    notifications_paused: v.notifications_paused,
  }

  if (v.id) {
    const { error } = await supabase.from('safeguard_configurations').update(row).eq('id', v.id)
    if (error) return { ok: false, error: 'Could not update the configuration.' }
    revalidatePath('/app/inventory/safeguards')
    return { ok: true, id: v.id }
  }
  const { data, error } = await supabase
    .from('safeguard_configurations')
    .insert(row)
    .select('id')
    .single()
  if (error || !data) return { ok: false, error: 'Could not create the configuration.' }
  revalidatePath('/app/inventory/safeguards')
  return { ok: true, id: data.id }
}

export async function toggleSafeguardActive(id: number, active: boolean): Promise<InventoryResult> {
  await requirePermission('rulebuilder', 'create')
  const supabase = await createClient()
  const { error } = await supabase
    .from('safeguard_configurations')
    .update({ is_active: active })
    .eq('id', id)
  if (error) return { ok: false, error: 'Could not toggle the configuration.' }
  revalidatePath('/app/inventory/safeguards')
  return { ok: true }
}

export async function deleteSafeguardConfiguration(id: number): Promise<InventoryResult> {
  await requirePermission('rulebuilder', 'delete')
  const supabase = await createClient()
  const { error } = await supabase.from('safeguard_configurations').delete().eq('id', id)
  if (error) return { ok: false, error: 'Could not delete the configuration.' }
  revalidatePath('/app/inventory/safeguards')
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Device-health schedulers  (messaging module — a user manages their own)
// ---------------------------------------------------------------------------
const healthSchedulerSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  schedule_title: z.string().trim().min(1).max(255),
  time_zone: z.string().trim().min(1),
  time: z.string().trim().regex(/^\d{2}:\d{2}$/),
  days: z.array(z.string().max(10)).optional().default([]),
  selected_devices: z.array(z.coerce.number().int().positive()).optional().default([]),
})

export async function saveDeviceHealthScheduler(input: unknown): Promise<InventoryResult> {
  const actor = await requireAuth()
  const hasId = !!(input && (input as { id?: unknown }).id)
  if (!actor.isSuperAdmin && !actor.isCustomer) {
    await requirePermission('messaging', hasId ? 'update' : 'create', { allowCustomer: true })
  }
  const parsed = healthSchedulerSchema.safeParse(input)
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors }
  const v = parsed.data
  const supabase = await createClient()

  const row = {
    schedule_title: v.schedule_title,
    time_zone: v.time_zone,
    time: v.time,
    days: Array.from(new Set(v.days)),
    selected_devices: Array.from(new Set(v.selected_devices)),
  }

  if (v.id) {
    const { error } = await supabase
      .from('device_health_schedulers')
      .update(row)
      .eq('id', v.id)
      .eq('user_id', actor.id)
    if (error) return { ok: false, error: 'Could not update the scheduler.' }
    revalidatePath('/app/inventory/device-health')
    return { ok: true, id: v.id }
  }
  const { data, error } = await supabase
    .from('device_health_schedulers')
    .insert({ ...row, user_id: actor.id })
    .select('id')
    .single()
  if (error || !data) return { ok: false, error: 'Could not create the scheduler.' }
  revalidatePath('/app/inventory/device-health')
  return { ok: true, id: data.id }
}

export async function deleteDeviceHealthScheduler(id: number): Promise<InventoryResult> {
  const actor = await requireAuth()
  const supabase = await createClient()
  const { error } = await supabase
    .from('device_health_schedulers')
    .delete()
    .eq('id', id)
    .eq('user_id', actor.id)
  if (error) return { ok: false, error: 'Could not delete the scheduler.' }
  revalidatePath('/app/inventory/device-health')
  return { ok: true }
}
