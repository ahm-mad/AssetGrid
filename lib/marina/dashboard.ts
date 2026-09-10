import 'server-only'

import { createClient } from '@/utils/supabase/server'

/**
 * Marina dashboard aggregations — ports `MarinaController@getMarinaDeviceData` /
 * `@getInventoryDeviceBatteryStatus` / `@getCountOfSensors` /
 * `@getAlertsByAttributes` / `@marinaBoatsStatus`.
 *
 * 🔧 Same N+1 fix as buildings: "latest per device" is one query off
 * `user_devices.last_reading`; the marina's devices are resolved via
 * `boats → boat_devices → inventory_devices`.
 */

interface BoatDeviceReading {
  boatId: number
  boatName: string
  inventoryDeviceId: number
  deviceName: string | null
  devEui: string | null
  userDeviceId: number | null
  reading: Record<string, unknown> | null
  readingAt: string | null
}

async function marinaBoatReadings(marinaId: number): Promise<BoatDeviceReading[]> {
  const supabase = await createClient()
  const { data: boats } = await supabase
    .from('boats')
    .select('id, boat_name, boat_devices(inventory_device_id)')
    .eq('marina_id', marinaId)
  const map = new Map<number, { boatId: number; boatName: string }>()
  const ids: number[] = []
  for (const b of boats ?? []) {
    for (const bd of (b.boat_devices as { inventory_device_id: number }[] | null) ?? []) {
      map.set(bd.inventory_device_id, { boatId: b.id, boatName: b.boat_name })
      ids.push(bd.inventory_device_id)
    }
  }
  if (ids.length === 0) return []

  const { data: invs } = await supabase
    .from('inventory_devices')
    .select(
      'id, name, dev_eui, user_devices:user_devices!user_devices_inventory_device_id_fkey(id, device_name, last_reading, last_reading_at)',
    )
    .in('id', ids)

  return (invs ?? []).map((inv) => {
    const ud = ((inv.user_devices as { id: number; device_name: string | null; last_reading: unknown; last_reading_at: string | null }[] | null) ?? [])[0]
    const b = map.get(inv.id)!
    return {
      boatId: b.boatId,
      boatName: b.boatName,
      inventoryDeviceId: inv.id,
      deviceName: ud?.device_name ?? inv.name ?? null,
      devEui: inv.dev_eui,
      userDeviceId: ud?.id ?? null,
      reading: (ud?.last_reading as Record<string, unknown> | null) ?? null,
      readingAt: ud?.last_reading_at ?? null,
    }
  })
}

function num(v: unknown): number | null {
  return v == null || v === '' ? null : Number(v)
}

export interface MarinaBatteryRow {
  boatName: string
  deviceName: string | null
  devEui: string | null
  voltage: number | null
  readingAt: string | null
}

export async function getMarinaBatteryStatus(marinaId: number): Promise<MarinaBatteryRow[]> {
  const rows = await marinaBoatReadings(marinaId)
  return rows.map((r) => ({
    boatName: r.boatName,
    deviceName: r.deviceName,
    devEui: r.devEui,
    voltage: num(r.reading?.voltage),
    readingAt: r.readingAt,
  }))
}

export interface MarinaSensorCounts {
  total: number
  reporting: number
  silent: number
  alarmActive: number
}

export async function getMarinaSensorCounts(marinaId: number): Promise<MarinaSensorCounts> {
  const rows = await marinaBoatReadings(marinaId)
  const now = Date.now()
  let reporting = 0
  let alarmActive = 0
  for (const r of rows) {
    if (r.readingAt && now - new Date(r.readingAt).getTime() < 86_400_000) reporting++
    if (r.reading?.external_input === true || num(r.reading?.external_input) === 1) alarmActive++
  }
  return { total: rows.length, reporting, silent: rows.length - reporting, alarmActive }
}

export interface MarinaAlertRow {
  id: number
  boatId: number | null
  payload: Record<string, unknown>
  createdAt: string
}

/** `marinas/{id}/sensors/alerts/by-attributes` — recent `marina_alerts` rows. */
export async function getMarinaAlerts(marinaId: number, limit = 50): Promise<MarinaAlertRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('marina_alerts')
    .select('id, boat_id, payload, created_at')
    .eq('marina_id', marinaId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map((a) => ({
    id: a.id,
    boatId: a.boat_id,
    payload: (a.payload as Record<string, unknown>) ?? {},
    createdAt: a.created_at,
  }))
}
