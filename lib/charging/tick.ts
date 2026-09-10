import 'server-only'

import { createServiceClient } from '@/utils/supabase/service'
import { sendDownlink, TURN_OFF_DEVICE, TURN_ON_DEVICE } from '@/lib/devices/downlink'

/**
 * The 30-second charging/schedule enforcement loop — ports the old
 * `ScheduleDeviceCharging` / `RelayScheduleDeviceCharging` +
 * `QuickChargingTimer` timeout logic (`06-webhooks-iot.md` §6,
 * `integrations-plan.md` §5).
 *
 * Runs as an internal endpoint (`POST /api/internal/charging-tick`) hit by
 * `pg_cron` (N+2). Idempotent: it only issues a downlink + state update when
 * the desired on/off state differs from `device_charging_state.is_on`.
 *
 * DONE: clock `device_schedules` (times treated as UTC — the old app stored
 *       them UTC after a client-side tz conversion), quick `charging_timers`.
 * DEFERRED (B50): `sunset_rises` needs real sunrise/sunset times for the
 *       device's lat/long — a solar-position calc + geo per device.
 */

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export interface TickResult {
  ok: boolean
  scheduleChecked: number
  timerChecked: number
  commandsIssued: number
  errors: string[]
}

function nowUtcParts(): { day: string; time: string } {
  const d = new Date()
  const time = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
  return { day: DAY_NAMES[d.getUTCDay()], time }
}

/** A schedule window can wrap past midnight (start 22:00, end 06:00). */
function withinTimeWindow(now: string, start: string, end: string): boolean {
  const s = start.slice(0, 5)
  const e = end.slice(0, 5)
  if (s <= e) return now >= s && now <= e
  return now >= s || now <= e
}

export async function runChargingTick(): Promise<TickResult> {
  const db = createServiceClient()
  const res: TickResult = { ok: true, scheduleChecked: 0, timerChecked: 0, commandsIssued: 0, errors: [] }
  const { day, time } = nowUtcParts()

  // ---- clock schedules ----
  const { data: schedules } = await db
    .from('device_schedules')
    .select('id, user_device_id, start_time, end_time, selected_days, turn_on')
  const desiredByDevice = new Map<number, boolean>()

  for (const s of schedules ?? []) {
    res.scheduleChecked++
    if (!s.user_device_id || !s.turn_on) continue // turn_on=false => schedule disabled
    const days = (s.selected_days as string[] | null) ?? []
    const activeDay = days.length === 0 || days.includes(day)
    const desired = activeDay && withinTimeWindow(time, s.start_time, s.end_time)
    // A device with several schedules: "ON during any window" wins.
    const prev = desiredByDevice.get(s.user_device_id)
    desiredByDevice.set(s.user_device_id, prev === true ? true : desired)
  }

  for (const [userDeviceId, desired] of desiredByDevice) {
    const applied = await applyDesiredState(db, userDeviceId, desired)
    if (applied === 'error') res.errors.push(`schedule apply failed for ${userDeviceId}`)
    else if (applied === 'changed') res.commandsIssued++
  }

  // ---- quick charging timers ----
  const { data: timers } = await db
    .from('charging_timers')
    .select('id, user_device_id, seconds, is_active')
    .eq('kind', 'quick')
    .eq('is_active', true)

  for (const t of timers ?? []) {
    res.timerChecked++
    if (!t.user_device_id || !t.seconds) continue
    const { data: state } = await db
      .from('device_charging_state')
      .select('is_on, last_command, last_command_at')
      .eq('user_device_id', t.user_device_id)
      .maybeSingle()
    if (!state?.is_on || state.last_command !== TURN_ON_DEVICE || !state.last_command_at) continue

    const elapsed = (Date.now() - new Date(state.last_command_at).getTime()) / 1000
    if (elapsed >= t.seconds) {
      const applied = await applyDesiredState(db, t.user_device_id, false)
      if (applied === 'error') res.errors.push(`timer apply failed for ${t.user_device_id}`)
      else if (applied === 'changed') res.commandsIssued++
      await db.from('charging_timers').update({ is_active: false }).eq('id', t.id)
    }
  }

  res.ok = res.errors.length === 0
  return res
}

async function applyDesiredState(
  db: ReturnType<typeof createServiceClient>,
  userDeviceId: number,
  desiredOn: boolean,
): Promise<'noop' | 'changed' | 'error'> {
  const { data: state } = await db
    .from('device_charging_state')
    .select('is_on, dev_eui')
    .eq('user_device_id', userDeviceId)
    .maybeSingle()
  if (!state) return 'noop'
  if (state.is_on === desiredOn) return 'noop'

  const devEui = state.dev_eui ?? ''
  const command = desiredOn ? TURN_ON_DEVICE : TURN_OFF_DEVICE
  const sent = await sendDownlink(devEui, command)
  if (!sent) return 'error'

  const { error } = await db
    .from('device_charging_state')
    .update({
      is_on: desiredOn,
      is_charging: desiredOn,
      last_status: desiredOn ? 'on' : 'off',
      last_command: command,
      last_command_at: new Date().toISOString(),
    })
    .eq('user_device_id', userDeviceId)
  return error ? 'error' : 'changed'
}
