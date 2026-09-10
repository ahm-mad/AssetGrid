import 'server-only'

import type { DecodedReading } from '@/lib/telemetry/decode'

/**
 * Alert engine entry point — called inline from the sensor webhook after a
 * telemetry row is written (`06-webhooks-iot.md` §2 steps 7–10).
 *
 * SLICE 5b builds this out: system `attributes` evaluation
 * (`comparisonCheck`/`2`/`4`), the customer `alert_rules` DSL, `alert_windows`
 * suppression, the safeguard throttle (`safeguard_configurations` +
 * `alert_state`), and the fan-out (Resend / Twilio / `neo_alarm_logs` /
 * Realtime via the `alert_state` write).
 *
 * For now it is a no-op that records what it would evaluate.
 */

export interface AlertEngineInput {
  type: string
  telemetryId: number
  devEui: string | null
  reading: DecodedReading
  previousReading: Record<string, unknown> | null
  resolved: {
    inventoryDeviceId: number | null
    userDeviceId: number | null
    userId: string | null
    productId: number | null
    notifieId: number | null
  }
}

export async function runAlertEngine(input: AlertEngineInput): Promise<void> {
  // TODO(slice 5b): evaluate attributes + alert_rules + alert_windows +
  // safeguard throttle; fan out.
  console.info(
    `[alerts] TODO(5b): would evaluate telemetry #${input.telemetryId} ` +
      `(dev ${input.devEui}, product ${input.resolved.productId})`,
  )
}
