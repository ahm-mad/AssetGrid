import 'server-only'

import { createServiceClient } from '@/utils/supabase/service'
import { sendMail } from '@/lib/mail/resend'

/**
 * `DeviceHealthSchedulerCommand` (`device-health:run`, every 1 min) — ports the
 * device-health report job. For each `device_health_schedulers` row whose
 * local time (in its timezone) matches `time` on an active day, send the owner
 * a health summary of the selected inventory devices.
 *
 * De-dup: the cron fires once per minute and we match on the exact HH:mm, so a
 * row sends at most once per scheduled minute. (A `last_run_at` column would be
 * sturdier — deferred, B51.)
 */

export interface HealthRunResult {
  ok: boolean
  checked: number
  sent: number
  errors: string[]
}

function localHHmm(tz: string): { day: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz || 'UTC',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date())
  const day = parts.find((p) => p.type === 'weekday')?.value ?? ''
  const hh = parts.find((p) => p.type === 'hour')?.value ?? '00'
  const mm = parts.find((p) => p.type === 'minute')?.value ?? '00'
  return { day, time: `${hh === '24' ? '00' : hh}:${mm}` }
}

export async function runDeviceHealth(): Promise<HealthRunResult> {
  const db = createServiceClient()
  const res: HealthRunResult = { ok: true, checked: 0, sent: 0, errors: [] }

  const { data: schedulers } = await db
    .from('device_health_schedulers')
    .select('id, user_id, schedule_title, time_zone, time, days, selected_devices')

  for (const s of schedulers ?? []) {
    res.checked++
    const { day, time } = localHHmm(s.time_zone)
    const days = ((s.days as string[] | null) ?? []).map((d) => d.slice(0, 3).toLowerCase())
    const activeDay = days.length === 0 || days.includes(day.slice(0, 3).toLowerCase())
    if (!activeDay || time !== s.time.slice(0, 5)) continue

    const deviceIds = (s.selected_devices as number[] | null) ?? []
    if (deviceIds.length === 0) continue

    const { data: devices } = await db
      .from('inventory_devices')
      .select('id, name, dev_eui, user_devices:user_devices!user_devices_inventory_device_id_fkey(device_name, status, last_reading, last_reading_at)')
      .in('id', deviceIds)

    const lines = (devices ?? []).map((d) => {
      const ud = ((d.user_devices as { device_name: string | null; status: string; last_reading: unknown; last_reading_at: string | null }[] | null) ?? [])[0]
      const seen = ud?.last_reading_at ? new Date(ud.last_reading_at).toISOString() : 'never'
      const r = (ud?.last_reading ?? {}) as Record<string, unknown>
      return `• ${d.name} (${d.dev_eui ?? '—'}) — status ${ud?.status ?? 'unclaimed'}, last packet ${seen}` +
        (r.temperature != null ? `, temp ${r.temperature}` : '') +
        (r.voltage != null ? `, batt ${r.voltage}` : '')
    })

    const { data: auth } = await db.auth.admin.getUserById(s.user_id)
    const email = auth.user?.email
    if (!email) continue

    const r = await sendMail({
      to: email,
      subject: s.schedule_title || 'Device health report',
      text: `Device health report — ${s.schedule_title}\n\n${lines.join('\n')}`,
    })
    if (r.ok) res.sent++
    else res.errors.push(`scheduler ${s.id}: ${r.error}`)
  }

  res.ok = res.errors.length === 0
  return res
}
