import 'server-only'

/**
 * LNS downlink sender — STUB.
 *
 * Ports `App\Traits\ChargingTrait::sendUpLink`, which POSTs a queue item to the
 * LoRaWAN network server so a relay/charger device turns on or off.
 *
 * The old code carried a **hardcoded LNS JWT** (tech-debt A8). The real
 * implementation must read the host + token from the environment
 * (`LNS_DOWNLINK_HOST` / `LNS_DOWNLINK_TOKEN`) — but the user has **not
 * provided those values yet**, so this is a `console.warn` no-op for now.
 *
 * Charging Server Actions still update `device_charging_state` /
 * `charging_timers` in the database; only the physical downlink is skipped.
 * The real send (and the 30-second enforcement loop) lands in slice 5
 * (IoT integrations).
 *
 * Note: the old `sendUpLink` always returned truthy (its `finally` block forced
 * `$respose = true`), so the documented "rollback on downlink failure" never
 * actually fired. We keep returning `true` here for behavioural parity, while
 * the callers are structured to roll back if a real send ever returns `false`.
 */

export const TURN_ON_DEVICE = 'AAH/' as const
export const TURN_OFF_DEVICE = 'AAEA' as const

export type DownlinkCommand = typeof TURN_ON_DEVICE | typeof TURN_OFF_DEVICE

export async function sendDownlink(devEui: string, command: DownlinkCommand): Promise<boolean> {
  const host = process.env.LNS_DOWNLINK_HOST
  const token = process.env.LNS_DOWNLINK_TOKEN

  if (!host || !token) {
    // TODO(A8): real LNS downlink — needs LNS_DOWNLINK_HOST / LNS_DOWNLINK_TOKEN
    // from the user, then POST `${host}/api/devices/${devEui}/queue` with
    // { deviceQueueItem: { confirmed: false, data: command, fPort: 10 } } and
    // header `Grpc-Metadata-Authorization: ${token}`.
    console.warn(
      `[downlink] TODO(A8): LNS_DOWNLINK_HOST/TOKEN not set — skipping "${command}" downlink to ${devEui}`,
    )
    return true
  }

  // TODO(A8): implement the real fetch once the LNS endpoint + token exist.
  console.warn(
    `[downlink] TODO(A8): real downlink not implemented yet — would send "${command}" to ${devEui}`,
  )
  return true
}
