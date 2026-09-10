import 'server-only'

import { createClient } from '@/utils/supabase/server'

/**
 * Reads for the messaging / notification-config surface:
 * `notification_prefs` (was `notifications`), `alert_windows`
 * (was `notification_schedulers`), `device_notification_recipients`
 * (was `notification_addresses`).
 */

export interface NotificationPrefRow {
  id: number
  userId: string | null
  userDeviceId: number | null
  companyId: number | null
  emailEnabled: boolean
  phoneEnabled: boolean
  customerPhoneEnabled: boolean
  customerEmailEnabled: boolean
  managerPhoneEnabled: boolean
  managerEmailEnabled: boolean
  devicePhoneEnabled: boolean
  deviceEmailEnabled: boolean
}

const PREF_COLS =
  'id, user_id, user_device_id, company_id, email_enabled, phone_enabled, customer_phone_enabled, customer_email_enabled, manager_phone_enabled, manager_email_enabled, device_phone_enabled, device_email_enabled'

function toPref(p: Record<string, unknown>): NotificationPrefRow {
  return {
    id: p.id as number,
    userId: (p.user_id as string | null) ?? null,
    userDeviceId: (p.user_device_id as number | null) ?? null,
    companyId: (p.company_id as number | null) ?? null,
    emailEnabled: !!p.email_enabled,
    phoneEnabled: !!p.phone_enabled,
    customerPhoneEnabled: !!p.customer_phone_enabled,
    customerEmailEnabled: !!p.customer_email_enabled,
    managerPhoneEnabled: !!p.manager_phone_enabled,
    managerEmailEnabled: !!p.manager_email_enabled,
    devicePhoneEnabled: !!p.device_phone_enabled,
    deviceEmailEnabled: !!p.device_email_enabled,
  }
}

/** The caller's own notification prefs (creates the shape lazily in the UI). */
export async function getMyNotificationPrefs(userId: string): Promise<NotificationPrefRow | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('notification_prefs')
    .select(PREF_COLS)
    .eq('user_id', userId)
    .is('user_device_id', null)
    .limit(1)
    .maybeSingle()
  return data ? toPref(data) : null
}

export interface AlertWindowRow {
  id: number
  ruleName: string | null
  buildingId: number | null
  marinaId: number | null
  companyId: number | null
  attributeKey: string
  inventories: { value: string; label: string }[]
  days: string[]
  recurrence: string
  startTime: string
  endTime: string
  timezone: string
}

export async function listAlertWindows(): Promise<AlertWindowRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('alert_windows')
    .select(
      'id, rule_name, building_id, marina_id, company_id, attribute_key, inventories, days, recurrence, start_time, end_time, timezone',
    )
    .order('id', { ascending: false })
  if (error) throw error
  return (data ?? []).map((w) => ({
    id: w.id,
    ruleName: w.rule_name,
    buildingId: w.building_id,
    marinaId: w.marina_id,
    companyId: w.company_id,
    attributeKey: w.attribute_key,
    inventories: (w.inventories as { value: string; label: string }[] | null) ?? [],
    days: (w.days as string[] | null) ?? [],
    recurrence: w.recurrence,
    startTime: w.start_time,
    endTime: w.end_time,
    timezone: w.timezone,
  }))
}

export interface DeviceRecipientsRow {
  id: number
  userDeviceId: number | null
  deviceName: string | null
  emails: string[]
  phoneNumbers: string[]
}

export async function listDeviceRecipients(): Promise<DeviceRecipientsRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('device_notification_recipients')
    .select('id, user_device_id, emails, phone_numbers, user_device:user_devices(device_name)')
    .order('id', { ascending: false })
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id,
    userDeviceId: r.user_device_id,
    deviceName: (r.user_device as { device_name?: string } | null)?.device_name ?? null,
    emails: (r.emails as string[] | null) ?? [],
    phoneNumbers: (r.phone_numbers as string[] | null) ?? [],
  }))
}

/** `GET get-device/notification/address/{userDevice}`. */
export async function getDeviceRecipients(userDeviceId: number): Promise<DeviceRecipientsRow | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('device_notification_recipients')
    .select('id, user_device_id, emails, phone_numbers')
    .eq('user_device_id', userDeviceId)
    .maybeSingle()
  if (!data) return null
  return {
    id: data.id,
    userDeviceId: data.user_device_id,
    deviceName: null,
    emails: (data.emails as string[] | null) ?? [],
    phoneNumbers: (data.phone_numbers as string[] | null) ?? [],
  }
}
