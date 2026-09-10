import 'server-only'

import { createClient } from '@/utils/supabase/server'

/**
 * Building dashboard aggregations — ports `BuildingController`'s
 * `getBuildingDeviceData` / `getInventoryDeviceBatteryStatus` /
 * `getCountOfSensors` / `getDeviceValuesWithExternalInputOne` /
 * `getDeviceValuesWithVoltageFilter`.
 *
 * 🔧 The old versions each ran a **per-device Mongo query** for the latest
 * packet (the documented N+1 — `puser.testresult.txt`). Here "latest per
 * device" comes from the `user_devices.last_reading` cache in **one** query;
 * the time-series read hits the partitioned `telemetry` table once.
 */

interface DeviceReadingRow {
  siteId: number
  roomName: string
  userDeviceId: number | null
  deviceName: string | null
  devEui: string | null
  reading: Record<string, unknown> | null
  readingAt: string | null
}

async function buildingDeviceReadings(buildingId: number): Promise<DeviceReadingRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('sites')
    .select(
      'id, room_name, inventory_device_id, inventory_device:inventory_devices(dev_eui, name, user_devices:user_devices!user_devices_inventory_device_id_fkey(id, device_name, last_reading, last_reading_at))',
    )
    .eq('building_id', buildingId)
    .not('inventory_device_id', 'is', null)
    .order('id')

  return (data ?? []).map((s) => {
    const inv = s.inventory_device as {
      dev_eui?: string | null
      name?: string | null
      user_devices?: {
        id: number
        device_name: string | null
        last_reading: unknown
        last_reading_at: string | null
      }[]
    } | null
    const ud = (inv?.user_devices ?? [])[0]
    return {
      siteId: s.id,
      roomName: s.room_name,
      userDeviceId: ud?.id ?? null,
      deviceName: ud?.device_name ?? inv?.name ?? null,
      devEui: inv?.dev_eui ?? null,
      reading: (ud?.last_reading as Record<string, unknown> | null) ?? null,
      readingAt: ud?.last_reading_at ?? null,
    }
  })
}

function num(v: unknown): number | null {
  return v == null || v === '' ? null : Number(v)
}

export interface BatteryStatusRow {
  siteId: number
  roomName: string
  deviceName: string | null
  devEui: string | null
  voltage: number | null
  readingAt: string | null
}

export async function getBuildingBatteryStatus(buildingId: number): Promise<BatteryStatusRow[]> {
  const rows = await buildingDeviceReadings(buildingId)
  return rows.map((r) => ({
    siteId: r.siteId,
    roomName: r.roomName,
    deviceName: r.deviceName,
    devEui: r.devEui,
    voltage: num(r.reading?.voltage),
    readingAt: r.readingAt,
  }))
}

export interface SensorCounts {
  total: number
  reporting: number
  silent: number
  alarmActive: number
  motion: number
}

export async function getBuildingSensorCounts(buildingId: number): Promise<SensorCounts> {
  const rows = await buildingDeviceReadings(buildingId)
  const staleMs = 24 * 3600_000
  const now = Date.now()
  let reporting = 0
  let alarmActive = 0
  let motion = 0
  for (const r of rows) {
    if (r.readingAt && now - new Date(r.readingAt).getTime() < staleMs) reporting++
    if (r.reading?.external_input === true || num(r.reading?.external_input) === 1) alarmActive++
    if (r.reading?.move === true || num(r.reading?.move) === 1) motion++
  }
  return {
    total: rows.length,
    reporting,
    silent: rows.length - reporting,
    alarmActive,
    motion,
  }
}

export interface DeviceSeriesPoint {
  createdAt: string
  temperature: number | null
  humidity: number | null
  voltage: number | null
  externalInput: boolean | null
}

/** Time-series for every device in a building — one windowed `telemetry` read. */
export async function getBuildingDeviceData(
  buildingId: number,
  interval: 'daily' | 'weekly' | 'monthly' = 'daily',
): Promise<Record<number, DeviceSeriesPoint[]>> {
  const supabase = await createClient()
  const windowMs = { daily: 86_400_000, weekly: 604_800_000, monthly: 2_592_000_000 }[interval]
  const since = new Date(Date.now() - windowMs).toISOString()

  const rows = await buildingDeviceReadings(buildingId)
  const ids = rows.map((r) => r.userDeviceId).filter((n): n is number => n != null)
  if (ids.length === 0) return {}

  const { data } = await supabase
    .from('telemetry')
    .select('user_device_id, created_at, temperature, humidity, voltage, external_input')
    .in('user_device_id', ids)
    .gte('created_at', since)
    .order('created_at', { ascending: true })
    .limit(5000)

  const out: Record<number, DeviceSeriesPoint[]> = {}
  for (const t of data ?? []) {
    const k = t.user_device_id as number
    ;(out[k] ??= []).push({
      createdAt: t.created_at,
      temperature: t.temperature,
      humidity: t.humidity,
      voltage: t.voltage,
      externalInput: t.external_input,
    })
  }
  return out
}

export interface AlarmDeviceRow {
  userDeviceId: number
  deviceName: string | null
  devEui: string | null
  buildingCode: string | null
  roomName: string | null
  readingAt: string | null
}

/** `building/devices-data` — devices whose latest `external_input == 1` (alarm active), across the caller's buildings. */
export async function getDevicesWithExternalInput(): Promise<AlarmDeviceRow[]> {
  const supabase = await createClient()
  // RLS scopes `sites` to the caller. Read the cache; filter in JS (jsonb path
  // filters on a text-cast are brittle across null/'0'/false).
  const { data } = await supabase
    .from('sites')
    .select(
      'room_name, building:buildings(building_code), inventory_device:inventory_devices(dev_eui, name, user_devices:user_devices!user_devices_inventory_device_id_fkey(id, device_name, last_reading, last_reading_at))',
    )
    .not('inventory_device_id', 'is', null)
    .limit(2000)

  const rows: AlarmDeviceRow[] = []
  for (const s of data ?? []) {
    const inv = s.inventory_device as {
      dev_eui?: string | null
      name?: string | null
      user_devices?: { id: number; device_name: string | null; last_reading: unknown; last_reading_at: string | null }[]
    } | null
    const ud = (inv?.user_devices ?? [])[0]
    const r = (ud?.last_reading ?? {}) as Record<string, unknown>
    if (ud && (r.external_input === true || Number(r.external_input) === 1)) {
      rows.push({
        userDeviceId: ud.id,
        deviceName: ud.device_name ?? inv?.name ?? null,
        devEui: inv?.dev_eui ?? null,
        buildingCode: (s.building as { building_code?: string } | null)?.building_code ?? null,
        roomName: s.room_name,
        readingAt: ud.last_reading_at,
      })
    }
  }
  return rows
}
