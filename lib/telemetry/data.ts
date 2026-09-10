import 'server-only'

import { createClient } from '@/utils/supabase/server'

/**
 * Telemetry reads for the app. All RLS-scoped: `telemetry` SELECT uses
 * `auth_owns_user_device()` / the `inventory` scope, so a caller only ever sees
 * their own devices' rows.
 *
 * "Current reading" comes from `user_devices.last_reading` (the hot-path cache —
 * ADR-022), NOT a telemetry scan. Time-series reads hit `telemetry` with a
 * windowed query on the `(user_device_id, created_at desc)` index.
 */

export interface TelemetryPoint {
  createdAt: string
  temperature: number | null
  humidity: number | null
  voltage: number | null
  current: number | null
  activePower: number | null
  externalInput: boolean | null
  move: boolean | null
  reedState: number | null
}

const SERIES_COLS =
  'created_at, temperature, humidity, voltage, current, active_power, external_input, move, reed_state'

function toPoint(r: {
  created_at: string
  temperature: number | null
  humidity: number | null
  voltage: number | null
  current: number | null
  active_power: number | null
  external_input: boolean | null
  move: boolean | null
  reed_state: number | null
}): TelemetryPoint {
  return {
    createdAt: r.created_at,
    temperature: r.temperature,
    humidity: r.humidity,
    voltage: r.voltage,
    current: r.current,
    activePower: r.active_power,
    externalInput: r.external_input,
    move: r.move,
    reedState: r.reed_state,
  }
}

const WINDOW_MS: Record<string, number> = {
  daily: 24 * 3600_000,
  weekly: 7 * 24 * 3600_000,
  monthly: 30 * 24 * 3600_000,
}

/** Time-series for one device (`devices/values/{id}`, `sensors/get-data-values/{id}`). */
export async function getDeviceTelemetrySeries(
  userDeviceId: number,
  interval: 'daily' | 'weekly' | 'monthly' = 'daily',
  limit = 1000,
): Promise<TelemetryPoint[]> {
  const since = new Date(Date.now() - (WINDOW_MS[interval] ?? WINDOW_MS.daily)).toISOString()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('telemetry')
    .select(SERIES_COLS)
    .eq('user_device_id', userDeviceId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map(toPoint)
}

/** Latest cached reading for a device (from the `user_devices` cache). */
export async function getLatestReading(
  userDeviceId: number,
): Promise<{ reading: Record<string, unknown> | null; at: string | null }> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('user_devices')
    .select('last_reading, last_reading_at')
    .eq('id', userDeviceId)
    .maybeSingle()
  return {
    reading: (data?.last_reading as Record<string, unknown> | null) ?? null,
    at: data?.last_reading_at ?? null,
  }
}

/**
 * "Latest reading per device" for a set of devices — one query, no N+1
 * (`devices/data-values`, building/marina dashboards). Reads the caches.
 */
export async function getLatestReadings(
  userDeviceIds: number[],
): Promise<Map<number, { reading: Record<string, unknown> | null; at: string | null }>> {
  const out = new Map<number, { reading: Record<string, unknown> | null; at: string | null }>()
  if (userDeviceIds.length === 0) return out
  const supabase = await createClient()
  const { data } = await supabase
    .from('user_devices')
    .select('id, last_reading, last_reading_at')
    .in('id', userDeviceIds)
  for (const d of data ?? []) {
    out.set(d.id, {
      reading: (d.last_reading as Record<string, unknown> | null) ?? null,
      at: d.last_reading_at,
    })
  }
  return out
}
