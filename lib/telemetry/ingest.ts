import 'server-only'

import { createServiceClient } from '@/utils/supabase/service'
import { decodeUplink, mergeLastReading, type DecodedReading } from '@/lib/telemetry/decode'

/**
 * The ingestion pipeline (`06-webhooks-iot.md` §2, steps 1–6):
 * decode → resolve device → append a `telemetry` row → refresh the
 * `user_devices.last_reading` cache (merged with the previous packet — B37).
 *
 * The alert engine (`lib/alerts/`, slice 5b) is called separately by the
 * webhook handler with the `IngestResult` this returns.
 *
 * Service-role client: a webhook has no user session, and telemetry has no
 * write policy (reads are RLS-scoped per subscriber).
 */

export interface IngestResult {
  ok: boolean
  reason?: string
  telemetryId?: number
  devEui: string | null
  reading: DecodedReading
  resolved: {
    inventoryDeviceId: number | null
    userDeviceId: number | null
    userId: string | null
    productId: number | null
    notifieId: number | null
  }
  previousReading: Record<string, unknown> | null
}

export async function ingestUplink(type: string, body: unknown): Promise<IngestResult> {
  const reading = decodeUplink(type, body)
  const base = {
    devEui: reading.devEui,
    reading,
    resolved: {
      inventoryDeviceId: null,
      userDeviceId: null,
      userId: null,
      productId: null,
      notifieId: null,
    },
    previousReading: null as Record<string, unknown> | null,
  }

  if (!reading.devEui) {
    return { ok: false, reason: 'missing_or_invalid_devEUI', ...base }
  }

  const db = createServiceClient()

  const { data: inv } = await db
    .from('inventory_devices')
    .select('id, product_id, product:products(notifie_id)')
    .eq('dev_eui', reading.devEui)
    .maybeSingle()

  const inventoryDeviceId = inv?.id ?? null
  const productId = inv?.product_id ?? null
  const notifieId = (inv?.product as { notifie_id?: number } | null)?.notifie_id ?? null

  let userDeviceId: number | null = null
  let userId: string | null = null
  let previousReading: Record<string, unknown> | null = null

  if (inventoryDeviceId) {
    const { data: ud } = await db
      .from('user_devices')
      .select('id, user_id, last_reading')
      .eq('inventory_device_id', inventoryDeviceId)
      .order('id')
      .limit(1)
      .maybeSingle()
    if (ud) {
      userDeviceId = ud.id
      userId = ud.user_id
      previousReading = (ud.last_reading as Record<string, unknown> | null) ?? null
    }
  }

  const resolved = { inventoryDeviceId, userDeviceId, userId, productId, notifieId }
  const now = new Date().toISOString()

  // --- append the telemetry row ---
  const { data: row, error } = await db
    .from('telemetry')
    .insert({
      created_at: now,
      dev_eui: reading.devEui,
      gateway_id: reading.gatewayId,
      user_id: userId,
      user_device_id: userDeviceId,
      inventory_device_id: inventoryDeviceId,
      energy_consumption_meter_consumed: reading.energy_consumption_meter_consumed,
      energy_consumption_meter_elapsed: reading.energy_consumption_meter_elapsed,
      active_power: reading.active_power,
      apparent_power: reading.apparent_power,
      reactive_power: reading.reactive_power,
      power_factor: reading.power_factor,
      voltage: reading.voltage,
      current: reading.current,
      humidity: reading.humidity,
      temperature: reading.temperature,
      luminosity: reading.luminosity,
      external_input: reading.external_input,
      light: reading.light,
      move: reading.move,
      reed_state: reading.reed_state,
      latitude: reading.latitude,
      longitude: reading.longitude,
      altitude: reading.altitude,
      raw_body: reading.rawBody as never,
      raw_source: 'live',
    })
    .select('id')
    .single()

  if (error || !row) {
    return { ok: false, reason: `telemetry_insert_failed: ${error?.message}`, ...base, resolved }
  }

  // --- refresh the current-state cache on user_devices ---
  if (userDeviceId) {
    const merged = mergeLastReading(previousReading, reading)
    await db
      .from('user_devices')
      .update({
        last_reading: merged as never,
        last_reading_at: now,
        last_reading_id: row.id,
        last_dev_eui: reading.devEui,
      })
      .eq('id', userDeviceId)
  }

  return {
    ok: true,
    telemetryId: row.id,
    ...base,
    resolved,
    previousReading,
  }
}
