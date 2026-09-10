import 'server-only'

import { createClient } from '@/utils/supabase/server'
import {
  calculateChargingProgress,
  calculateConsumedEnergy,
  chargingTimeEstimate,
  checkPowerFactorStatus,
  overcurrentStatus,
  overvoltageStatus,
  voltageCurrentStatus,
} from '@/lib/charging/calc'

/**
 * `user_devices` reads — ports `UserDeviceController@userDevices` /
 * `@getUserDevices` / `@deviceChargingDetail` and the per-device config
 * getters (`DeviceParameterController`, `DeviceScheduleChargingController`,
 * `SunsetRiseController`, `StartCharging@getChargingTimer`).
 *
 * Visibility is RLS: `user_devices` uses `auth_owns_user_device(id)`, which
 * encodes the old per-role ownership (Customer = own rows, Manager/Admin =
 * same company, Dealer = own container codes, Partner = own inventory ids,
 * Super Admin = all). So no manual role branching here.
 *
 * "Latest reading" comes from `user_devices.last_reading` (jsonb cache), NOT a
 * telemetry scan (ADR-022). Until the telemetry ETL runs (Phase N+1) that
 * cache is empty, so charging detail degrades to "no values" — same shape the
 * old API returned when a device had no `DeviceValue`.
 */

export interface UserDeviceRow {
  id: number
  xnid: string | null
  deviceName: string | null
  deviceLocation: string | null
  status: string
  devEui: string | null
  toggleStatus: boolean
  activatedAt: string | null
  inventoryDeviceId: number | null
  inventoryDeviceName: string | null
  productName: string | null
  deviceTypeId: number | null
  ownerId: string
  ownerName: string | null
  ownerXnid: string | null
  isOn: boolean | null
  isCharging: boolean
  lastReadingAt: string | null
}

export interface UserDeviceListParams {
  page?: number
  perPage?: number
  search?: string
  userId?: string
  status?: 'decline' | 'captured'
}

export interface UserDeviceListResult {
  rows: UserDeviceRow[]
  total: number
  page: number
  perPage: number
  totalPages: number
}

export interface DeviceParametersRow {
  id: number
  devEui: string | null
  batteryVoltage: number | null
  batteryCapacity: number | null
  desiredCharging: number | null
  chargingLimits: number | null
  chargerVoltage: number | null
  chargerAmperes: number | null
  overCurrentProtection: boolean
  overVoltageProtection: boolean
  smsAlert: boolean
  emailAlert: boolean
  isDefault: boolean
}

export interface DeviceScheduleRow {
  id: number
  startTime: string
  endTime: string
  selectedDays: unknown
  turnOn: boolean
  reminder: boolean
  deviceTypeId: number
}

export interface SunsetRiseRow {
  id: number
  sunrise: number
  sunset: number
  selectedDays: unknown
  turnOn: boolean
  reminder: boolean
  deviceTypeId: number
}

export interface ChargingTimerRow {
  id: number
  kind: 'standard' | 'quick'
  seconds: number | null
  isActive: boolean
}

export interface ChargingStateRow {
  isOn: boolean | null
  isCharging: boolean
  lastStatus: string | null
  lastCommand: string | null
  lastCommandAt: string | null
  devEui: string | null
}

export interface ChargingDetail {
  hasReading: boolean
  activeEnergy: number | null
  chargingProgress: number | null
  powerFactorStatus: string | null
  voltageCurrentStatus: string | null
  overcurrentStatus: string | null
  overvoltageStatus: string | null
  chargingTime: string | null
  state: ChargingStateRow | null
}

export interface UserDeviceBundle {
  device: UserDeviceRow & {
    notificationEmail: string | null
    notificationPhoneNumber: string | null
    activationCode: string | null
  }
  parameters: DeviceParametersRow | null
  schedules: DeviceScheduleRow[]
  sunsetRises: SunsetRiseRow[]
  chargingTimers: ChargingTimerRow[]
  chargingState: ChargingStateRow | null
  chargingDetail: ChargingDetail
}

const LIST_SELECT =
  'id, xnid, device_name, device_location, status, dev_eui, toggle_status, activated_at, ' +
  'inventory_device_id, last_reading_at, user_id, ' +
  'owner:profiles!user_devices_user_id_fkey(first_name, last_name, xnid), ' +
  'inventory_device:inventory_devices(name, product:products(product_name, device_type_id)), ' +
  'charging_state:device_charging_state(is_on, is_charging)'

type ListEmbeddedRow = {
  id: number
  xnid: string | null
  device_name: string | null
  device_location: string | null
  status: string
  dev_eui: string | null
  toggle_status: boolean
  activated_at: string | null
  inventory_device_id: number | null
  last_reading_at: string | null
  user_id: string
  owner: { first_name: string | null; last_name: string | null; xnid: string | null } | null
  inventory_device:
    | { name: string | null; product: { product_name: string | null; device_type_id: number | null } | null }
    | null
  charging_state: { is_on: boolean | null; is_charging: boolean } | { is_on: boolean | null; is_charging: boolean }[] | null
}

function ownerNameOf(o: { first_name: string | null; last_name: string | null; xnid: string | null } | null): string | null {
  if (!o) return null
  return [o.first_name, o.last_name].filter(Boolean).join(' ') || o.xnid || null
}

function chargingStateOf(
  cs: ListEmbeddedRow['charging_state'],
): { is_on: boolean | null; is_charging: boolean } | null {
  if (!cs) return null
  return Array.isArray(cs) ? (cs[0] ?? null) : cs
}

function toListRow(r: ListEmbeddedRow): UserDeviceRow {
  const cs = chargingStateOf(r.charging_state)
  return {
    id: r.id,
    xnid: r.xnid,
    deviceName: r.device_name,
    deviceLocation: r.device_location,
    status: r.status,
    devEui: r.dev_eui,
    toggleStatus: r.toggle_status,
    activatedAt: r.activated_at,
    inventoryDeviceId: r.inventory_device_id,
    inventoryDeviceName: r.inventory_device?.name ?? null,
    productName: r.inventory_device?.product?.product_name ?? null,
    deviceTypeId: r.inventory_device?.product?.device_type_id ?? null,
    ownerId: r.user_id,
    ownerName: ownerNameOf(r.owner),
    ownerXnid: r.owner?.xnid ?? null,
    isOn: cs?.is_on ?? null,
    isCharging: cs?.is_charging ?? false,
    lastReadingAt: r.last_reading_at,
  }
}

export async function listUserDevices(
  params: UserDeviceListParams = {},
): Promise<UserDeviceListResult> {
  const page = Math.max(1, params.page ?? 1)
  const perPage = Math.min(200, Math.max(1, params.perPage ?? 20))
  const from = (page - 1) * perPage
  const to = from + perPage - 1

  const supabase = await createClient()
  let query = supabase.from('user_devices').select(LIST_SELECT, { count: 'exact' })

  if (params.userId) query = query.eq('user_id', params.userId)
  if (params.status) query = query.eq('status', params.status)
  if (params.search?.trim()) {
    const s = params.search.trim().replace(/[%,()]/g, '')
    query = query.or(`device_name.ilike.%${s}%,dev_eui.ilike.%${s}%,xnid.ilike.%${s}%`)
  }

  const { data, count, error } = await query.order('id', { ascending: false }).range(from, to)
  if (error) throw error

  const total = count ?? 0
  return {
    rows: (data ?? []).map((r) => toListRow(r as unknown as ListEmbeddedRow)),
    total,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  }
}

function paramRow(p: {
  id: number
  dev_eui: string | null
  battery_voltage: number | null
  battery_capacity: number | null
  desired_charging: number | null
  charging_limits: number | null
  charger_voltage: number | null
  charger_amperes: number | null
  over_current_protection: boolean
  over_voltage_protection: boolean
  sms_alert: boolean
  email_alert: boolean
  is_default: boolean
}): DeviceParametersRow {
  return {
    id: p.id,
    devEui: p.dev_eui,
    batteryVoltage: p.battery_voltage,
    batteryCapacity: p.battery_capacity,
    desiredCharging: p.desired_charging,
    chargingLimits: p.charging_limits,
    chargerVoltage: p.charger_voltage,
    chargerAmperes: p.charger_amperes,
    overCurrentProtection: p.over_current_protection,
    overVoltageProtection: p.over_voltage_protection,
    smsAlert: p.sms_alert,
    emailAlert: p.email_alert,
    isDefault: p.is_default,
  }
}

/**
 * Resolve the effective device parameters — mirrors
 * `CalculateChargingValuesTrait::getDeviceParameters`: device-specific row
 * first, then the owner's default, then any global default.
 */
async function resolveDeviceParameters(
  supabase: Awaited<ReturnType<typeof createClient>>,
  opts: { userDeviceId: number; ownerId: string },
): Promise<DeviceParametersRow | null> {
  const cols =
    'id, dev_eui, battery_voltage, battery_capacity, desired_charging, charging_limits, charger_voltage, charger_amperes, over_current_protection, over_voltage_protection, sms_alert, email_alert, is_default' as const

  const direct = await supabase
    .from('device_parameters')
    .select(cols)
    .eq('user_device_id', opts.userDeviceId)
    .limit(1)
    .maybeSingle()
  if (direct.data) return paramRow(direct.data)

  const ownerDefault = await supabase
    .from('device_parameters')
    .select(cols)
    .eq('is_default', true)
    .eq('user_id', opts.ownerId)
    .limit(1)
    .maybeSingle()
  if (ownerDefault.data) return paramRow(ownerDefault.data)

  const globalDefault = await supabase
    .from('device_parameters')
    .select(cols)
    .eq('is_default', true)
    .limit(1)
    .maybeSingle()
  return globalDefault.data ? paramRow(globalDefault.data) : null
}

/** A loose accessor for the `last_reading` jsonb cache. */
function readingNum(reading: unknown, key: string): number | null {
  if (!reading || typeof reading !== 'object') return null
  const v = (reading as Record<string, unknown>)[key]
  return v == null || v === '' ? null : Number(v)
}

export async function getUserDevice(id: number): Promise<UserDeviceBundle | null> {
  const supabase = await createClient()

  const { data: dev, error } = await supabase
    .from('user_devices')
    .select(
      LIST_SELECT +
        ', device_activation_code, notification_email, notification_phone_number, last_reading',
    )
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!dev) return null

  const d = dev as unknown as ListEmbeddedRow & {
    device_activation_code: string | null
    notification_email: string | null
    notification_phone_number: string | null
    last_reading: unknown
  }
  const base = toListRow(d)

  const [params, schedules, sunsetRises, timers, state] = await Promise.all([
    resolveDeviceParameters(supabase, { userDeviceId: id, ownerId: d.user_id }),
    supabase
      .from('device_schedules')
      .select('id, start_time, end_time, selected_days, turn_on, reminder, device_type_id')
      .eq('user_device_id', id)
      .order('id'),
    supabase
      .from('sunset_rises')
      .select('id, sunrise, sunset, selected_days, turn_on, reminder, device_type_id')
      .eq('user_device_id', id)
      .order('id'),
    supabase
      .from('charging_timers')
      .select('id, kind, seconds, is_active')
      .eq('user_device_id', id)
      .order('id'),
    supabase
      .from('device_charging_state')
      .select('is_on, is_charging, last_status, last_command, last_command_at, dev_eui')
      .eq('user_device_id', id)
      .maybeSingle(),
  ])

  const chargingState: ChargingStateRow | null = state.data
    ? {
        isOn: state.data.is_on,
        isCharging: state.data.is_charging,
        lastStatus: state.data.last_status,
        lastCommand: state.data.last_command,
        lastCommandAt: state.data.last_command_at,
        devEui: state.data.dev_eui,
      }
    : null

  const reading = d.last_reading
  const hasReading = !!reading && typeof reading === 'object' && Object.keys(reading).length > 0
  const batteryEnergy =
    (params?.batteryVoltage ?? 0) * (params?.batteryCapacity ?? 0)

  const chargingDetail: ChargingDetail = hasReading
    ? {
        hasReading: true,
        activeEnergy: calculateConsumedEnergy(
          readingNum(reading, 'active_power'),
          readingNum(reading, 'energy_consumption_meter_elapsed'),
        ),
        chargingProgress: calculateChargingProgress(
          readingNum(reading, 'energy_consumption_meter_consumed'),
          batteryEnergy,
        ),
        powerFactorStatus: checkPowerFactorStatus(readingNum(reading, 'power_factor')),
        voltageCurrentStatus: voltageCurrentStatus(
          readingNum(reading, 'voltage'),
          readingNum(reading, 'current'),
        ),
        overcurrentStatus: overcurrentStatus(readingNum(reading, 'current')),
        overvoltageStatus: overvoltageStatus(readingNum(reading, 'voltage')),
        chargingTime: chargingTimeEstimate(
          readingNum(reading, 'energy_consumption_meter_elapsed'),
          {
            battery_voltage: params?.batteryVoltage ?? null,
            battery_capacity: params?.batteryCapacity ?? null,
            charger_amperes: params?.chargerAmperes ?? null,
          },
        ),
        state: chargingState,
      }
    : {
        hasReading: false,
        activeEnergy: null,
        chargingProgress: null,
        powerFactorStatus: null,
        voltageCurrentStatus: null,
        overcurrentStatus: null,
        overvoltageStatus: null,
        chargingTime: null,
        state: chargingState,
      }

  return {
    device: {
      ...base,
      notificationEmail: d.notification_email,
      notificationPhoneNumber: d.notification_phone_number,
      activationCode: d.device_activation_code,
    },
    parameters: params,
    schedules: (schedules.data ?? []).map((s) => ({
      id: s.id,
      startTime: s.start_time,
      endTime: s.end_time,
      selectedDays: s.selected_days,
      turnOn: s.turn_on,
      reminder: s.reminder,
      deviceTypeId: s.device_type_id,
    })),
    sunsetRises: (sunsetRises.data ?? []).map((s) => ({
      id: s.id,
      sunrise: s.sunrise,
      sunset: s.sunset,
      selectedDays: s.selected_days,
      turnOn: s.turn_on,
      reminder: s.reminder,
      deviceTypeId: s.device_type_id,
    })),
    chargingTimers: (timers.data ?? []).map((t) => ({
      id: t.id,
      kind: t.kind,
      seconds: t.seconds,
      isActive: t.is_active,
    })),
    chargingState,
    chargingDetail,
  }
}
