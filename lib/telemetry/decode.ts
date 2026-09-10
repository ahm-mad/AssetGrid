import 'server-only'

/**
 * Sensor-uplink decoder — ports the parse blocks of the old
 * `Webhook*SensorController@getDataFromSensor` methods (`06-webhooks-iot.md` §2).
 *
 * The LNS posts one of two `objectJSON` shapes:
 *  - **environmental** (temp / humidity / reed / PIR / battery): flat keys
 *    `temperature`, `humidity`, `external_input`, `light`, `move`,
 *    `battery_voltage`, `reed_state`.
 *  - **electrical** (eMAX charger / relay): `objectJSON.data` keyed by
 *    `energy_consumption_meter.consumed` / `.elapsed`, `real_power`,
 *    `apparent_power`, `reactive_power`, `power_factor_meter`, `voltmeter`,
 *    `ammeter`, `relay_status`.
 *
 * `devEUI` and `rxInfo[0].gatewayID` arrive base64 → decode to upper-hex.
 */

const ELECTRICAL_TYPES = new Set(['data', 'relay-data'])

export interface DecodedReading {
  devEui: string | null
  gatewayId: string | null
  latitude: number | null
  longitude: number | null
  altitude: number | null

  energy_consumption_meter_consumed: number | null
  energy_consumption_meter_elapsed: number | null
  active_power: number | null
  apparent_power: number | null
  reactive_power: number | null
  power_factor: number | null
  voltage: number | null
  current: number | null

  humidity: number | null
  temperature: number | null
  luminosity: number | null

  external_input: boolean | null
  light: boolean | null
  move: boolean | null
  reed_state: number | null

  relay_status: number | null
  rawBody: unknown
}

function b64ToHexUpper(s: unknown): string | null {
  if (typeof s !== 'string' || s === '') return null
  try {
    return Buffer.from(s, 'base64').toString('hex').toUpperCase()
  } catch {
    return null
  }
}

function num(v: unknown, round?: number): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  if (Number.isNaN(n)) return null
  return round != null ? Math.round(n * 10 ** round) / 10 ** round : n
}

function bool(v: unknown): boolean | null {
  if (v == null || v === '') return null
  if (typeof v === 'boolean') return v
  const n = Number(v)
  if (!Number.isNaN(n)) return n !== 0
  return v === 'true' || v === 'on'
}

const empty = (): Omit<DecodedReading, 'devEui' | 'gatewayId' | 'latitude' | 'longitude' | 'altitude' | 'rawBody'> => ({
  energy_consumption_meter_consumed: null,
  energy_consumption_meter_elapsed: null,
  active_power: null,
  apparent_power: null,
  reactive_power: null,
  power_factor: null,
  voltage: null,
  current: null,
  humidity: null,
  temperature: null,
  luminosity: null,
  external_input: null,
  light: null,
  move: null,
  reed_state: null,
  relay_status: null,
})

export function decodeUplink(type: string, body: unknown): DecodedReading {
  const b = (body ?? {}) as Record<string, unknown>
  const rx = Array.isArray(b.rxInfo) ? (b.rxInfo[0] as Record<string, unknown> | undefined) : undefined
  const loc = (rx?.location ?? {}) as Record<string, unknown>

  let objectJSON: Record<string, unknown> = {}
  if (typeof b.objectJSON === 'string') {
    try {
      objectJSON = JSON.parse(b.objectJSON || '{}')
    } catch {
      objectJSON = {}
    }
  } else if (b.objectJSON && typeof b.objectJSON === 'object') {
    objectJSON = b.objectJSON as Record<string, unknown>
  }

  const out: DecodedReading = {
    devEui: b64ToHexUpper(b.devEUI),
    gatewayId: b64ToHexUpper(rx?.gatewayID),
    latitude: num(loc.latitude),
    longitude: num(loc.longitude),
    altitude: num(loc.altitude),
    rawBody: objectJSON,
    ...empty(),
  }

  if (ELECTRICAL_TYPES.has(type)) {
    const d = (objectJSON.data ?? {}) as Record<string, unknown>
    out.energy_consumption_meter_consumed = num(d['energy_consumption_meter.consumed'])
    out.energy_consumption_meter_elapsed = num(d['energy_consumption_meter.elapsed'])
    out.active_power = num(d['real_power'] ?? d['active_power'])
    out.apparent_power = num(d['apparent_power'])
    out.reactive_power = num(d['reactive_power'])
    out.power_factor = num(d['power_factor_meter'] ?? d['power_factor'])
    out.voltage = num(d['voltmeter'] ?? d['voltage'])
    out.current = num(d['ammeter'] ?? d['current'])
    out.relay_status = num(d['relay_status'])
    return out
  }

  // Environmental family.
  out.temperature = num(objectJSON['temperature'], 2)
  out.humidity = num(objectJSON['humidity'], 2)
  out.luminosity = num(objectJSON['luminosity'], 2)
  out.light = bool(objectJSON['light'])
  out.move = bool(objectJSON['move'])
  out.voltage = num(objectJSON['battery_voltage'], 2)
  out.external_input = bool(objectJSON['external_input'])
  out.reed_state = objectJSON['reed_state'] != null ? Number(objectJSON['reed_state']) : null

  // Packet-type null rules (parity with the old controller):
  // a temp/humidity packet carries no external_input / move / reed_state;
  // an external_input packet carries no reed_state.
  if (out.temperature !== null || out.humidity !== null) {
    out.external_input = null
    out.move = null
    out.reed_state = null
  }
  if (out.external_input !== null) {
    out.reed_state = null
  }

  return out
}

/** Merge a fresh reading over the previous `last_reading` cache (fixes B37). */
export function mergeLastReading(
  previous: Record<string, unknown> | null | undefined,
  reading: DecodedReading,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...(previous ?? {}) }
  const fields: (keyof DecodedReading)[] = [
    'energy_consumption_meter_consumed',
    'energy_consumption_meter_elapsed',
    'active_power',
    'apparent_power',
    'reactive_power',
    'power_factor',
    'voltage',
    'current',
    'humidity',
    'temperature',
    'luminosity',
    'external_input',
    'light',
    'move',
    'reed_state',
    'relay_status',
    'latitude',
    'longitude',
    'altitude',
    'gatewayId',
  ]
  for (const f of fields) {
    if (reading[f] !== null && reading[f] !== undefined) merged[f] = reading[f]
  }
  merged.dev_eui = reading.devEui
  merged._at = new Date().toISOString()
  return merged
}
