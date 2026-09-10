'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createClient } from '@/utils/supabase/server'
import { requirePermission } from '@/lib/auth/guards'
import { sendDownlink, TURN_OFF_DEVICE, TURN_ON_DEVICE } from '@/lib/devices/downlink'
import { calculateChargingProgress } from '@/lib/charging/calc'

/**
 * Charging control + schedules — ports `StartCharging`,
 * `DeviceScheduleChargingController`, `SunsetRiseController`.
 *
 * Old middleware for all of these is `permission:inventory,update` (charging in
 * the old app is an inventory-admin capability, not a customer self-service
 * one — the routes carry no `,customer` scope). We keep that gate for parity.
 *
 * The physical LNS downlink goes through `lib/devices/downlink.ts`, which is a
 * stub until the user provides `LNS_DOWNLINK_*` (A8). The DB state
 * (`device_charging_state`, `charging_timers`, `energy_usage_sessions`) is
 * always updated. The 30-second enforcement loop is slice 5.
 */

export interface ChargingResult {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string[]>
  message?: string
  status?: 'on' | 'off'
}

const FULL_DAYS: Record<string, string> = {
  M: 'Monday',
  Tu: 'Tuesday',
  W: 'Wednesday',
  Th: 'Thursday',
  F: 'Friday',
  Sa: 'Saturday',
  Su: 'Sunday',
}
const VALID_FULL = new Set(Object.values(FULL_DAYS))

function normalizeDays(days: string[]): string[] {
  const out: string[] = []
  for (const d of days) {
    const full = FULL_DAYS[d] ?? (VALID_FULL.has(d) ? d : null)
    if (full && !out.includes(full)) out.push(full)
  }
  return out
}

/** Resolve the product's device_type_id for a claimed device (needed by both schedule types). */
async function resolveDeviceTypeId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userDeviceId: number,
): Promise<number | null> {
  const { data } = await supabase
    .from('user_devices')
    .select('inventory_device:inventory_devices(product:products(device_type_id), device_type_id)')
    .eq('id', userDeviceId)
    .maybeSingle()
  const inv = data?.inventory_device as
    | { product: { device_type_id: number | null } | null; device_type_id: number | null }
    | null
  return inv?.product?.device_type_id ?? inv?.device_type_id ?? null
}

// ---------------------------------------------------------------------------
// changeChargingStatus  (POST devices/change/charging/status)
// ---------------------------------------------------------------------------
const changeSchema = z.object({
  user_device_id: z.coerce.number().int().positive(),
  dev_eui: z.string().trim().optional(),
})

export async function changeChargingStatus(input: unknown): Promise<ChargingResult> {
  await requirePermission('inventory', 'update')
  const parsed = changeSchema.safeParse(input)
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors }
  const { user_device_id } = parsed.data
  const supabase = await createClient()

  const { data: ud } = await supabase
    .from('user_devices')
    .select(
      'id, user_id, dev_eui, last_reading, inventory_device_id, inventory_device:inventory_devices(dev_eui), state:device_charging_state(is_on, is_charging)',
    )
    .eq('id', user_device_id)
    .maybeSingle()
  if (!ud) return { ok: false, error: 'No device found' }

  const devEui =
    parsed.data.dev_eui ||
    ud.dev_eui ||
    (ud.inventory_device as { dev_eui?: string | null } | null)?.dev_eui ||
    ''
  const state = (Array.isArray(ud.state) ? ud.state[0] : ud.state) as
    | { is_on: boolean | null; is_charging: boolean }
    | null
  const isOn = state?.is_on === true

  if (isOn) return stopCharging(supabase, ud.id, devEui)
  return startCharging(supabase, {
    id: ud.id,
    ownerId: ud.user_id,
    devEui,
    lastReading: ud.last_reading,
    inventoryDeviceId: ud.inventory_device_id,
  })
}

async function stopCharging(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userDeviceId: number,
  devEui: string,
): Promise<ChargingResult> {
  const now = new Date().toISOString()
  const today = now.slice(0, 10)

  const { error } = await supabase
    .from('device_charging_state')
    .update({
      is_on: false,
      is_charging: false,
      last_status: 'off',
      last_command: TURN_OFF_DEVICE,
      last_command_at: now,
    })
    .eq('user_device_id', userDeviceId)
  if (error) return { ok: false, error: 'Could not update the charging state.' }

  if (devEui) {
    await supabase
      .from('energy_usage_sessions')
      .update({ status: 'complete' })
      .eq('dev_eui', devEui)
      .eq('status', 'incomplete')
      .gte('created_at', `${today}T00:00:00Z`)
  }
  await supabase
    .from('charging_timers')
    .update({ is_active: false })
    .eq('user_device_id', userDeviceId)
    .eq('kind', 'quick')

  const sent = await sendDownlink(devEui, TURN_OFF_DEVICE)
  if (!sent) return { ok: false, error: 'Failed to send uplink' }

  revalidatePath(`/app/devices/${userDeviceId}`)
  return { ok: true, message: 'Charging is stopped', status: 'off' }
}

async function startCharging(
  supabase: Awaited<ReturnType<typeof createClient>>,
  d: {
    id: number
    ownerId: string
    devEui: string
    lastReading: unknown
    inventoryDeviceId: number | null
  },
): Promise<ChargingResult> {
  // Battery-full guard — resolve params, compute progress from the last reading.
  const reading = (d.lastReading ?? {}) as Record<string, unknown>
  const consumed = reading['energy_consumption_meter_consumed']
  if (consumed != null && consumed !== '') {
    const { data: params } = await supabase
      .from('device_parameters')
      .select('battery_voltage, battery_capacity')
      .or(`user_device_id.eq.${d.id},and(is_default.eq.true,user_id.eq.${d.ownerId})`)
      .limit(1)
      .maybeSingle()
    if (params) {
      const batteryEnergy = (params.battery_voltage ?? 0) * (params.battery_capacity ?? 0)
      if (calculateChargingProgress(Number(consumed), batteryEnergy) >= 100) {
        return { ok: true, message: 'Battery is already Full', status: 'off' }
      }
    }
  }

  const now = new Date().toISOString()
  const { error } = await supabase
    .from('device_charging_state')
    .update({
      is_on: true,
      is_charging: true,
      last_status: 'on',
      last_command: TURN_ON_DEVICE,
      last_command_at: now,
    })
    .eq('user_device_id', d.id)
  if (error) return { ok: false, error: 'Could not update the charging state.' }

  if (d.devEui) {
    await supabase
      .from('energy_usage_sessions')
      .insert({ dev_eui: d.devEui, status: 'incomplete', user_device_id: d.id })
  }

  const sent = await sendDownlink(d.devEui, TURN_ON_DEVICE)
  if (!sent) return { ok: false, error: 'Failed to send uplink' }

  revalidatePath(`/app/devices/${d.id}`)
  return { ok: true, message: 'Charging is started', status: 'on' }
}

// ---------------------------------------------------------------------------
// setChargingTimer  (POST devices/set/charging/timer)
// ---------------------------------------------------------------------------
const timerSchema = z.object({
  user_device_id: z.coerce.number().int().positive(),
  charging_time: z.coerce.number().int().nonnegative().nullable().optional(),
  active: z.coerce.boolean(),
})

export async function setChargingTimer(input: unknown): Promise<ChargingResult> {
  const actor = await requirePermission('inventory', 'update')
  const parsed = timerSchema.safeParse(input)
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors }
  const { user_device_id, charging_time, active } = parsed.data
  const supabase = await createClient()

  const { data: ud } = await supabase
    .from('user_devices')
    .select('id, user_id, dev_eui, inventory_device:inventory_devices(dev_eui), state:device_charging_state(is_on)')
    .eq('id', user_device_id)
    .maybeSingle()
  if (!ud) return { ok: false, error: 'No device found' }
  const devEui =
    ud.dev_eui || (ud.inventory_device as { dev_eui?: string | null } | null)?.dev_eui || ''
  const state = (Array.isArray(ud.state) ? ud.state[0] : ud.state) as { is_on: boolean | null } | null

  const { data: existing } = await supabase
    .from('charging_timers')
    .select('id')
    .eq('user_device_id', user_device_id)
    .eq('kind', 'quick')
    .limit(1)
    .maybeSingle()

  const row = { seconds: charging_time ?? null, is_active: active }
  if (existing) {
    const { error } = await supabase.from('charging_timers').update(row).eq('id', existing.id)
    if (error) return { ok: false, error: 'Failed to update charging time.' }
  } else {
    const { error } = await supabase
      .from('charging_timers')
      .insert({ ...row, kind: 'quick', user_device_id, user_id: ud.user_id ?? actor.id })
    if (error) return { ok: false, error: 'Failed to update charging time.' }
  }

  // Side-effect on the running state (parity with the old controller).
  if (active && state?.is_on === false) {
    const r = await startCharging(supabase, {
      id: user_device_id,
      ownerId: ud.user_id,
      devEui,
      lastReading: null,
      inventoryDeviceId: null,
    })
    revalidatePath(`/app/devices/${user_device_id}`)
    return r.ok
      ? { ok: true, message: 'Charging time is set and Charging is started', status: 'on' }
      : r
  }
  if (!active && state?.is_on === true) {
    const r = await stopCharging(supabase, user_device_id, devEui)
    revalidatePath(`/app/devices/${user_device_id}`)
    return r.ok
      ? { ok: true, message: 'Charging time is Unset and Charging is stopped', status: 'off' }
      : r
  }

  revalidatePath(`/app/devices/${user_device_id}`)
  return { ok: true, message: active ? 'Charging time is set' : 'Charging time is unset' }
}

// ---------------------------------------------------------------------------
// Device schedules  (clock)  — POST devices/schedules (+ update / delete)
// ---------------------------------------------------------------------------
const scheduleSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  user_device_id: z.coerce.number().int().positive(),
  start_time: z.string().trim().regex(/^\d{2}:\d{2}$/),
  end_time: z.string().trim().regex(/^\d{2}:\d{2}$/),
  selected_days: z.array(z.string()).min(1),
  reminder: z.coerce.boolean().optional().default(false),
  turn_on: z.coerce.boolean().optional().default(true),
})

export async function saveDeviceSchedule(input: unknown): Promise<ChargingResult> {
  await requirePermission('inventory', 'update')
  const parsed = scheduleSchema.safeParse(input)
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors }
  const v = parsed.data
  const supabase = await createClient()

  const days = normalizeDays(v.selected_days)
  if (days.length === 0) return { ok: false, error: 'Select at least one day.' }

  if (v.id) {
    const { error } = await supabase
      .from('device_schedules')
      .update({
        start_time: v.start_time,
        end_time: v.end_time,
        selected_days: days,
        reminder: v.reminder,
        turn_on: v.turn_on,
      })
      .eq('id', v.id)
    if (error) return { ok: false, error: 'Could not update the schedule.' }
    revalidatePath(`/app/devices/${v.user_device_id}`)
    return { ok: true, message: 'Schedule is updated' }
  }

  const deviceTypeId = await resolveDeviceTypeId(supabase, v.user_device_id)
  if (!deviceTypeId) return { ok: false, error: 'Device has no product / device type.' }

  const { error } = await supabase.from('device_schedules').insert({
    user_device_id: v.user_device_id,
    device_type_id: deviceTypeId,
    start_time: v.start_time,
    end_time: v.end_time,
    selected_days: days,
    reminder: v.reminder,
    turn_on: true,
  })
  if (error) return { ok: false, error: 'Could not create the schedule.' }
  revalidatePath(`/app/devices/${v.user_device_id}`)
  return { ok: true, message: 'success' }
}

export async function deleteDeviceSchedule(id: number, userDeviceId: number): Promise<ChargingResult> {
  await requirePermission('inventory', 'delete')
  const supabase = await createClient()
  const { error } = await supabase.from('device_schedules').delete().eq('id', id)
  if (error) return { ok: false, error: 'Schedule can not be deleted' }
  revalidatePath(`/app/devices/${userDeviceId}`)
  return { ok: true, message: 'Schedule is Deleted' }
}

// ---------------------------------------------------------------------------
// Sunset / sunrise schedules — POST devices/time-schedules (+ update / delete)
// ---------------------------------------------------------------------------
const sunsetSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  user_device_id: z.coerce.number().int().positive(),
  sunrise: z.coerce.number().int(),
  sunset: z.coerce.number().int(),
  selected_days: z.array(z.string()).min(1),
  reminder: z.coerce.boolean().optional().default(false),
  turn_on: z.coerce.boolean().optional().default(true),
})

export async function saveSunsetSchedule(input: unknown): Promise<ChargingResult> {
  await requirePermission('inventory', 'update')
  const parsed = sunsetSchema.safeParse(input)
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors }
  const v = parsed.data
  const supabase = await createClient()

  const days = normalizeDays(v.selected_days)
  if (days.length === 0) return { ok: false, error: 'Select at least one day.' }

  if (v.id) {
    const { error } = await supabase
      .from('sunset_rises')
      .update({
        sunrise: v.sunrise,
        sunset: v.sunset,
        selected_days: days,
        reminder: v.reminder,
        turn_on: v.turn_on,
      })
      .eq('id', v.id)
    if (error) return { ok: false, error: 'Could not update the schedule.' }
    revalidatePath(`/app/devices/${v.user_device_id}`)
    return { ok: true, message: 'Schedule is updated' }
  }

  const deviceTypeId = await resolveDeviceTypeId(supabase, v.user_device_id)
  if (!deviceTypeId) return { ok: false, error: 'Device has no product / device type.' }

  const { error } = await supabase.from('sunset_rises').insert({
    user_device_id: v.user_device_id,
    device_type_id: deviceTypeId,
    sunrise: v.sunrise,
    sunset: v.sunset,
    selected_days: days,
    reminder: v.reminder,
    turn_on: true,
  })
  if (error) return { ok: false, error: 'Could not create the schedule.' }
  revalidatePath(`/app/devices/${v.user_device_id}`)
  return { ok: true, message: 'success' }
}

export async function deleteSunsetSchedule(id: number, userDeviceId: number): Promise<ChargingResult> {
  await requirePermission('inventory', 'delete')
  const supabase = await createClient()
  const { error } = await supabase.from('sunset_rises').delete().eq('id', id)
  if (error) return { ok: false, error: 'Schedule can not be deleted' }
  revalidatePath(`/app/devices/${userDeviceId}`)
  return { ok: true, message: 'Schedule is Deleted' }
}
