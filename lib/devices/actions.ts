'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createClient } from '@/utils/supabase/server'
import { requireAuth, requirePermission } from '@/lib/auth/guards'

export interface DeviceActionResult {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string[]>
  toggleStatus?: boolean
}

/**
 * `PUT devices/user-devices/{id}` (`UserDeviceController@updateUserDeviceFields`)
 * — rename / relocate a claimed device, plus the two per-device notification
 * fields that now live directly on `user_devices` (the array-valued
 * `notification_addresses` behaviour is slice 9). Old middleware:
 * `permission:inventory,update`.
 */
const fieldsSchema = z.object({
  id: z.coerce.number().int().positive(),
  device_name: z.string().trim().max(255).optional(),
  device_location: z.string().trim().max(255).optional(),
  notification_email: z.string().trim().max(255).optional(),
  notification_phone_number: z.string().trim().max(255).optional(),
})

export async function updateUserDeviceFields(input: unknown): Promise<DeviceActionResult> {
  await requirePermission('inventory', 'update')
  const parsed = fieldsSchema.safeParse(input)
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors }
  const v = parsed.data

  const patch: {
    device_name?: string | null
    device_location?: string | null
    notification_email?: string | null
    notification_phone_number?: string | null
  } = {}
  if (v.device_name !== undefined) patch.device_name = v.device_name || null
  if (v.device_location !== undefined) patch.device_location = v.device_location || null
  if (v.notification_email !== undefined) patch.notification_email = v.notification_email || null
  if (v.notification_phone_number !== undefined)
    patch.notification_phone_number = v.notification_phone_number || null

  if (Object.keys(patch).length === 0) return { ok: true }

  const supabase = await createClient()
  const { error } = await supabase.from('user_devices').update(patch).eq('id', v.id)
  if (error) return { ok: false, error: 'Could not update the device.' }
  revalidatePath(`/app/devices/${v.id}`)
  revalidatePath('/app/devices')
  return { ok: true }
}

/**
 * `GET devices/toggle/{id}` (`DeviceValueController@toggle`) — flips
 * `user_devices.toggle_status`. Self-service route (`auth:api` only); RLS
 * requires the caller to own the device. Old was a `GET` that mutates — a
 * toggle is a clear Action (endpoint-mapping §4.4, B2 alias kept).
 */
export async function toggleUserDevice(id: number): Promise<DeviceActionResult> {
  await requireAuth()
  const supabase = await createClient()
  const { data: current, error: readErr } = await supabase
    .from('user_devices')
    .select('toggle_status')
    .eq('id', id)
    .maybeSingle()
  if (readErr || !current) return { ok: false, error: 'Device not found.' }

  const next = !current.toggle_status
  const { error } = await supabase.from('user_devices').update({ toggle_status: next }).eq('id', id)
  if (error) return { ok: false, error: 'Could not update the toggle.' }
  revalidatePath(`/app/devices/${id}`)
  return { ok: true, toggleStatus: next }
}

/**
 * `POST devices/parameters` / `devices/default/parameters`
 * (`DeviceParameterController@storeDeviceParameters` /
 * `@storeDefaultDeviceParameters`) — the per-device (or per-user default)
 * battery/charger config + over-current/voltage protection + alert toggles.
 * `updateOrCreate` keyed on `(dev_eui, user_device_id)` for a device, or
 * `(user_id, is_default)` for a default. Old middleware: `permission:inventory,update`.
 */
const paramsSchema = z.object({
  user_device_id: z.coerce.number().int().positive().optional(),
  is_default: z.coerce.boolean().optional().default(false),
  battery_voltage: z.coerce.number().int().nullable().optional(),
  battery_capacity: z.coerce.number().int().nullable().optional(),
  desired_charging: z.coerce.number().int().nullable().optional(),
  charging_limits: z.coerce.number().int().nullable().optional(),
  charger_voltage: z.coerce.number().int().nullable().optional(),
  charger_amperes: z.coerce.number().int().nullable().optional(),
  over_current_protection: z.coerce.boolean().optional().default(true),
  over_voltage_protection: z.coerce.boolean().optional().default(true),
  sms_alert: z.coerce.boolean().optional().default(true),
  email_alert: z.coerce.boolean().optional().default(true),
})

export async function saveDeviceParameters(input: unknown): Promise<DeviceActionResult> {
  const actor = await requirePermission('inventory', 'update')
  const parsed = paramsSchema.safeParse(input)
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors }
  const v = parsed.data

  if (!v.is_default && !v.user_device_id) {
    return { ok: false, error: 'A device or the default flag is required.' }
  }

  const supabase = await createClient()

  const values = {
    battery_voltage: v.battery_voltage ?? null,
    battery_capacity: v.battery_capacity ?? null,
    desired_charging: v.desired_charging ?? null,
    charging_limits: v.charging_limits ?? null,
    charger_voltage: v.charger_voltage ?? null,
    charger_amperes: v.charger_amperes ?? null,
    over_current_protection: v.over_current_protection,
    over_voltage_protection: v.over_voltage_protection,
    sms_alert: v.sms_alert,
    email_alert: v.email_alert,
  }

  if (v.is_default) {
    // updateOrCreate on (user_id, is_default) — resolve the row id first.
    const { data: existing } = await supabase
      .from('device_parameters')
      .select('id')
      .eq('user_id', actor.id)
      .eq('is_default', true)
      .limit(1)
      .maybeSingle()
    if (existing) {
      const { error } = await supabase.from('device_parameters').update(values).eq('id', existing.id)
      if (error) return { ok: false, error: 'Could not save the default parameters.' }
    } else {
      const { error } = await supabase
        .from('device_parameters')
        .insert({ ...values, user_id: actor.id, is_default: true })
      if (error) return { ok: false, error: 'Could not save the default parameters.' }
    }
    revalidatePath('/app/devices')
    return { ok: true }
  }

  // Per-device: resolve dev_eui + inventory_device_id from the user_device.
  const { data: ud } = await supabase
    .from('user_devices')
    .select('id, user_id, inventory_device_id, dev_eui, inventory_device:inventory_devices(dev_eui)')
    .eq('id', v.user_device_id!)
    .maybeSingle()
  if (!ud) return { ok: false, error: 'Device not found.' }
  const devEui =
    ud.dev_eui ?? (ud.inventory_device as { dev_eui?: string | null } | null)?.dev_eui ?? null

  const { data: existing } = await supabase
    .from('device_parameters')
    .select('id')
    .eq('user_device_id', ud.id)
    .limit(1)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase.from('device_parameters').update(values).eq('id', existing.id)
    if (error) return { ok: false, error: 'Could not save the parameters.' }
  } else {
    const { error } = await supabase.from('device_parameters').insert({
      ...values,
      dev_eui: devEui,
      user_id: ud.user_id,
      user_device_id: ud.id,
      inventory_device_id: ud.inventory_device_id,
      is_default: false,
    })
    if (error) return { ok: false, error: 'Could not save the parameters.' }
  }

  revalidatePath(`/app/devices/${v.user_device_id}`)
  return { ok: true }
}
