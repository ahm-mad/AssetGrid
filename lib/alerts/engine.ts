import 'server-only'

import { createServiceClient } from '@/utils/supabase/service'
import type { DecodedReading } from '@/lib/telemetry/decode'
import { comparisonCheck, evaluateRuleConditions, type RuleCondition } from '@/lib/alerts/compare'
import { sendMail } from '@/lib/mail/resend'
import { sendSms } from '@/lib/notify/sms'

/**
 * The alerting engine — a port of `WebhookTempratureSensorController::
 * sendNotifyAlerts` + `::checkUserRules` (`06-webhooks-iot.md` §4). Called
 * inline from the sensor webhook after the telemetry row is written.
 *
 * Faithfully ported: the system-`attributes` comparison, the `alert_windows`
 * suppression, the safeguard throttle state machine
 * (`safeguard_configurations` + `alert_state`), and the customer `alert_rules`
 * DSL. Fan-out goes to the device's `device_notification_recipients` + the
 * owner, gated by `notification_prefs`, logged in `alert_log`.
 *
 * DEFERRED (tech-debt B49):
 *  - the checkin/recovery paired-attribute logic (recovery "back to normal"
 *    notifications)
 *  - the XupEdrBuilder / `xup_encoded_edr` build (→ Neo, integrations phase)
 *  - the real Neo CID send — an `attributes.neo_event_code` match inserts a
 *    `neo_alarm_logs` row `status='pending'` only when a building/marina site
 *    context exists (slices 6/7); the Edge Function drains it (N+2)
 *  - the full manager/customer/scope recipient fan-out (the old ~1200-line
 *    resolver); v1 = device recipients + owner
 *  - marina realtime alerts (`marina_alerts` table) → slice 7
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

type Db = ReturnType<typeof createServiceClient>

/** xup data_type → the reading value, with the old sendNotifyAlerts transforms. */
function buildValueMap(reading: DecodedReading): Record<string, number | boolean | null> {
  const toF = (c: number | null) => (c == null ? null : Math.round(((c * 9) / 5 + 32) * 10) / 10)
  return {
    temperature: toF(reading.temperature),
    humidity: reading.humidity,
    voltage: reading.voltage == null ? null : reading.voltage / 10,
    external_input: reading.external_input,
    move: reading.move,
    light: reading.light,
    reed_state: reading.reed_state,
    current: reading.current,
    active_power: reading.active_power,
    power_factor: reading.power_factor,
    latitude: reading.latitude,
    longitude: reading.longitude,
  }
}

interface Recipients {
  emails: string[]
  phones: string[]
}

async function resolveRecipients(
  db: Db,
  userDeviceId: number,
  userId: string | null,
): Promise<Recipients> {
  const emails = new Set<string>()
  const phones = new Set<string>()

  const { data: rec } = await db
    .from('device_notification_recipients')
    .select('emails, phone_numbers')
    .eq('user_device_id', userDeviceId)
    .maybeSingle()
  for (const e of rec?.emails ?? []) if (e) emails.add(e)
  for (const p of rec?.phone_numbers ?? []) if (p) phones.add(p)

  // Per-device notification_email / _phone columns on user_devices.
  const { data: ud } = await db
    .from('user_devices')
    .select('notification_email, notification_phone_number')
    .eq('id', userDeviceId)
    .maybeSingle()
  if (ud?.notification_email) emails.add(ud.notification_email)
  if (ud?.notification_phone_number) phones.add(ud.notification_phone_number)

  // Fall back to the owner's account email.
  if (userId) {
    const { data } = await db.auth.admin.getUserById(userId)
    if (data.user?.email) emails.add(data.user.email)
  }

  // Gate by notification_prefs (if a row exists).
  const { data: prefs } = await db
    .from('notification_prefs')
    .select('email_enabled, phone_enabled')
    .or(`user_device_id.eq.${userDeviceId}${userId ? `,user_id.eq.${userId}` : ''}`)
    .limit(1)
    .maybeSingle()

  return {
    emails: prefs && !prefs.email_enabled ? [] : [...emails],
    phones: prefs && !prefs.phone_enabled ? [...phones] : prefs ? [...phones] : [],
  }
}

async function fanOut(
  db: Db,
  opts: {
    recipients: Recipients
    subject: string
    message: string
    userId: string | null
    userDeviceId: number
    deviceName: string | null
    telemetryId: number
  },
): Promise<void> {
  const logRows: {
    user_id: string | null
    telemetry_id: number
    device_name: string | null
    user_device_id: number
    channel: 'email' | 'sms'
    recipient: string
    message: string
    subject: string
  }[] = []

  for (const to of opts.recipients.emails) {
    await sendMail({ to, subject: opts.subject, text: opts.message })
    logRows.push({
      user_id: opts.userId,
      telemetry_id: opts.telemetryId,
      device_name: opts.deviceName,
      user_device_id: opts.userDeviceId,
      channel: 'email',
      recipient: to,
      message: opts.message,
      subject: opts.subject,
    })
  }
  for (const to of opts.recipients.phones) {
    await sendSms(to, `${opts.subject}: ${opts.message}`)
    logRows.push({
      user_id: opts.userId,
      telemetry_id: opts.telemetryId,
      device_name: opts.deviceName,
      user_device_id: opts.userDeviceId,
      channel: 'sms',
      recipient: to,
      message: opts.message,
      subject: opts.subject,
    })
  }
  if (logRows.length > 0) await db.from('alert_log').insert(logRows)
}

/** Is `now` inside an `alert_windows` suppression window for this signal + device? */
function withinWindow(
  windows: {
    attribute_key: string
    inventories: unknown
    days: string[] | null
    start_time: string
    end_time: string
    timezone: string
  }[],
  attributeKey: string,
  inventoryDeviceId: number | null,
): boolean {
  for (const w of windows) {
    if (w.attribute_key !== attributeKey) continue
    const invs = (w.inventories as { value?: unknown }[] | null) ?? []
    const ids = invs.map((x) => String(x.value))
    if (inventoryDeviceId != null && !ids.includes(String(inventoryDeviceId))) continue

    // Local day + time in the window's timezone.
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: w.timezone || 'UTC',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    const parts = fmt.formatToParts(new Date())
    const day = (parts.find((p) => p.type === 'weekday')?.value ?? '').toLowerCase().slice(0, 3)
    const hh = parts.find((p) => p.type === 'hour')?.value ?? '00'
    const mm = parts.find((p) => p.type === 'minute')?.value ?? '00'
    const time = `${hh === '24' ? '00' : hh}:${mm}`

    const activeDays = (w.days ?? []).map((d) => d.toLowerCase().slice(0, 3))
    const isActiveDay = activeDays.length === 0 || activeDays.includes(day)
    const isActiveTime = time >= w.start_time.slice(0, 5) && time <= w.end_time.slice(0, 5)
    if (isActiveDay && isActiveTime) return true
  }
  return false
}

export async function runAlertEngine(input: AlertEngineInput): Promise<void> {
  const { userDeviceId, userId, productId, notifieId, inventoryDeviceId } = input.resolved
  if (!userDeviceId) return

  const db = createServiceClient()
  const valueMap = buildValueMap(input.reading)

  const { data: udRow } = await db
    .from('user_devices')
    .select('device_name')
    .eq('id', userDeviceId)
    .maybeSingle()
  const deviceName = udRow?.device_name ?? null

  // ---- safeguard config (global, active) ----
  const { data: sg } = await db
    .from('safeguard_configurations')
    .select('abnormal_alert_limit, alert_interval_hours')
    .eq('is_active', true)
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle()
  const limit = sg?.abnormal_alert_limit ?? 5
  const cooldownMin = Math.round(Number(sg?.alert_interval_hours ?? 1) * 60)
  const safeguardConfigExists = !!sg

  // ---- system attributes ----
  if (notifieId) {
    const [{ data: attributes }, { data: xups }, { data: windows }, recipients] = await Promise.all([
      db
        .from('attributes')
        .select('id, subject, threshold, comparison, alert_message, checkin, xup_id, neo_event_code')
        .eq('notifie_id', notifieId)
        .order('id'),
      db.from('xups').select('id, data_type'),
      db
        .from('alert_windows')
        .select('attribute_key, inventories, days, start_time, end_time, timezone'),
      resolveRecipients(db, userDeviceId, userId),
    ])
    const xupType = new Map((xups ?? []).map((x) => [x.id, x.data_type]))

    // preference gate: enabled attribute ids per xup
    const enabledByXup = new Map<number, Set<number>>()
    if (productId && userId) {
      const { data: prefs } = await db
        .from('user_xup_preferences')
        .select('xup_id, attribute_id, send_notification')
        .eq('user_id', userId)
        .eq('product_id', productId)
      for (const p of prefs ?? []) {
        if (p.xup_id == null || p.attribute_id == null) continue
        if (!enabledByXup.has(p.xup_id)) enabledByXup.set(p.xup_id, new Set())
        if (p.send_notification) enabledByXup.get(p.xup_id)!.add(p.attribute_id)
      }
    }

    for (const attr of attributes ?? []) {
      if (attr.checkin) continue // recovery path — deferred (B49)
      if (attr.threshold == null || attr.comparison == null) continue

      const dataType = attr.xup_id != null ? xupType.get(attr.xup_id) : null
      const key = dataType ?? attr.subject
      const raw = key in valueMap ? valueMap[key] : null
      if (raw == null) continue
      const value = typeof raw === 'boolean' ? (raw ? 1 : 0) : raw

      // preference gate
      const enabled = attr.xup_id != null ? enabledByXup.get(attr.xup_id) : undefined
      if (enabled && enabled.size > 0 && !enabled.has(attr.id)) continue

      // window suppression
      if (windows && withinWindow(windows, key, inventoryDeviceId)) continue

      const conditionMet = comparisonCheck(String(attr.comparison), value, attr.threshold)

      // ---- load/create the alert_state row ----
      const { data: existing } = await db
        .from('alert_state')
        .select('*')
        .eq('user_device_id', userDeviceId)
        .eq('attribute_id', attr.id)
        .maybeSingle()

      let state = existing
      if (!state) {
        const { data: created } = await db
          .from('alert_state')
          .insert({
            user_device_id: userDeviceId,
            attribute_id: attr.id,
            dev_eui: input.devEui ?? '',
            product_id: productId,
            notifie_id: notifieId,
            inventory_device_id: inventoryDeviceId,
            notification: key,
            notification_type: 'normal',
          })
          .select('*')
          .single()
        state = created
      }
      if (!state) continue

      const safeguardActive = safeguardConfigExists && !state.admin_bypass

      // auto-expire an elapsed pause
      if (safeguardActive && state.paused_until && new Date(state.paused_until) <= new Date()) {
        await db
          .from('alert_state')
          .update({
            notifications_paused: false,
            paused_until: null,
            alerts_count_24h: 0,
            window_started_at: null,
            notification_type: 'normal',
          })
          .eq('id', state.id)
        state = { ...state, notifications_paused: false, paused_until: null, alerts_count_24h: 0, notification_type: 'normal' }
      }

      // enforce an active pause
      if (
        safeguardActive &&
        state.notifications_paused &&
        state.paused_until &&
        new Date(state.paused_until) > new Date()
      ) {
        continue
      }

      if (!conditionMet) {
        if (state.notification_type === 'alert') {
          await db
            .from('alert_state')
            .update({
              notification_type: 'normal',
              is_alert: false,
              prev_value: state.value,
              value,
              ...(safeguardActive ? {} : { alerts_count_24h: 0, window_started_at: null }),
            })
            .eq('id', state.id)
        }
        continue
      }

      // condition met
      let send = true
      if (safeguardActive) {
        const count = state.alerts_count_24h + 1
        if (count >= limit) {
          await db
            .from('alert_state')
            .update({
              notifications_paused: true,
              paused_until: new Date(Date.now() + cooldownMin * 60_000).toISOString(),
              alerts_count_24h: 0,
              notification_type: 'alert',
              support_email_sent_at: new Date().toISOString(),
            })
            .eq('id', state.id)
          // support notification (parity — sendSupportEmail/SMS)
          if (recipients.emails.length) {
            await sendMail({
              to: recipients.emails,
              subject: `Repeated alerts on ${deviceName ?? input.devEui}`,
              text: `The safeguard limit of ${limit} was reached for "${attr.subject}". Notifications are paused for ${cooldownMin} minutes.`,
            })
          }
          // fall through and still send the limit-triggering alert
        } else if (state.notification_type === 'alert') {
          await db.from('alert_state').update({ alerts_count_24h: count }).eq('id', state.id)
          send = false
        } else {
          await db
            .from('alert_state')
            .update({
              notification_type: 'alert',
              last_alert_at: new Date().toISOString(),
              window_started_at: new Date().toISOString(),
              alerts_count_24h: count,
            })
            .eq('id', state.id)
        }
      }

      if (!send) continue

      await db
        .from('alert_state')
        .update({
          is_alert: true,
          value,
          prev_value: state.value,
          triggering_reading_id: input.telemetryId,
          last_alert_at: new Date().toISOString(),
          notification_type: 'alert',
        })
        .eq('id', state.id)

      const message =
        (attr.alert_message ? `${attr.alert_message}\n` : '') +
        `Device: ${deviceName ?? input.devEui}\n${attr.subject}: ${value}`

      await fanOut(db, {
        recipients,
        subject: attr.subject || 'Alert',
        message,
        userId,
        userDeviceId,
        deviceName,
        telemetryId: input.telemetryId,
      })

      // Neo: queue a pending row only when we can build an account context.
      // A building/marina site lookup is slices 6/7 — until then, record the
      // intent without an account_code so nothing is silently lost.
      if (attr.neo_event_code) {
        await db.from('neo_alarm_logs').insert({
          telemetry_id: input.telemetryId,
          account_code: '',
          point: 0,
          cid_code: attr.neo_event_code,
          event_code: attr.subject ?? attr.neo_event_code,
          status: 'pending',
        })
      }
    }
  }

  // ---- customer Rule Builder ----
  if (userId && inventoryDeviceId) {
    const { data: rules } = await db
      .from('alert_rules')
      .select('id, title, devices, conditions')
      .eq('user_id', userId)
      .eq('is_active', true)

    const ruleValues: Record<string, unknown> = { ...valueMap }
    const recipients = await resolveRecipients(db, userDeviceId, userId)

    for (const rule of rules ?? []) {
      const devices = (rule.devices as { inventory_device_id?: number }[] | null) ?? []
      if (!devices.some((d) => d.inventory_device_id === inventoryDeviceId)) continue
      if (!evaluateRuleConditions(rule.conditions as RuleCondition[] | null, ruleValues)) continue

      const lines = ((rule.conditions as RuleCondition[] | null) ?? [])
        .map((c) => `${c.selectedAttribute}: ${ruleValues[c.selectedAttribute ?? ''] ?? 'N/A'}`)
        .join('\n')
      await fanOut(db, {
        recipients,
        subject: rule.title || 'Rule Alert',
        message: `Rule Alert: ${rule.title ?? ''}\nDevice: ${deviceName ?? input.devEui}\n${lines}`,
        userId,
        userDeviceId,
        deviceName,
        telemetryId: input.telemetryId,
      })
    }
  }
}
