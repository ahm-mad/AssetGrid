import 'server-only'

import { createClient } from '@/utils/supabase/server'

/**
 * Inventory-device reads — ports the `ContainerController` / `InventoryDevice`
 * query endpoints (`inventoryDevices/index`, `/list`, `/container`, …).
 *
 * Scope is enforced by RLS: `inventory_devices` is visible to Super Admin, to a
 * user with `inventory` read whose data-scope covers the row
 * (`auth_scope_allows('inventory', id)`), or to a customer who owns a
 * `user_device` on it. So these functions do **no** manual role/scope
 * filtering — they just select.
 *
 * The LoRaWAN secrets (`nwkskey` / `appskey` / `app_key` / `app_eui` /
 * `dev_addr`) live in a separate `inventory_device_secrets` table (A10 /
 * ADR-025) and are **never** joined here. Use `getDeviceSecrets()` for the
 * gated provisioning view.
 */

export interface ContainerRow {
  id: number
  code: string
  deviceCount: number
}

export interface InventoryDeviceRow {
  id: number
  name: string
  description: string | null
  activationCode: string | null
  devEui: string | null
  xnid: string | null
  tCode: string | null
  serialNumber: string | null
  partNumber: string | null
  containerId: number
  containerCode: string | null
  productId: number
  productName: string | null
  deviceTypeId: number | null
  deviceTypeName: string | null
  companyId: number | null
  companyName: string | null
  claimed: boolean
  userDeviceId: number | null
  userDeviceStatus: string | null
  ownerName: string | null
}

export interface InventoryDeviceDetail extends InventoryDeviceRow {
  createdAt: string
  updatedAt: string
}

export interface InventoryDeviceSecrets {
  appKey: string | null
  appEui: string | null
  devAddr: string | null
  nwkskey: string | null
  appskey: string | null
}

export interface InventoryListParams {
  page?: number
  perPage?: number
  search?: string
  companyId?: number
  containerId?: number
}

export interface InventoryListResult {
  rows: InventoryDeviceRow[]
  total: number
  page: number
  perPage: number
  totalPages: number
}

const SELECT =
  'id, name, description, activation_code, dev_eui, xnid, t_code, serial_number, part_number, ' +
  'container_id, product_id, device_type_id, company_id, created_at, updated_at, ' +
  'container:containers(code), product:products(product_name), ' +
  'device_type:device_types(name), company:companies(company_name), ' +
  'user_devices:user_devices!user_devices_inventory_device_id_fkey(id, status, owner:profiles(first_name, last_name, xnid))'

type EmbeddedRow = {
  id: number
  name: string
  description: string | null
  activation_code: string | null
  dev_eui: string | null
  xnid: string | null
  t_code: string | null
  serial_number: string | null
  part_number: string | null
  container_id: number
  product_id: number
  device_type_id: number | null
  company_id: number | null
  created_at: string
  updated_at: string
  container: { code?: string } | null
  product: { product_name?: string | null } | null
  device_type: { name?: string } | null
  company: { company_name?: string } | null
  user_devices:
    | { id: number; status: string | null; owner: { first_name: string | null; last_name: string | null; xnid: string | null } | null }[]
    | null
}

function toRow(r: EmbeddedRow): InventoryDeviceDetail {
  const ud = (r.user_devices ?? [])[0] ?? null
  const owner = ud?.owner ?? null
  const ownerName = owner
    ? [owner.first_name, owner.last_name].filter(Boolean).join(' ') || owner.xnid || null
    : null
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    activationCode: r.activation_code,
    devEui: r.dev_eui,
    xnid: r.xnid,
    tCode: r.t_code,
    serialNumber: r.serial_number,
    partNumber: r.part_number,
    containerId: r.container_id,
    containerCode: r.container?.code ?? null,
    productId: r.product_id,
    productName: r.product?.product_name ?? null,
    deviceTypeId: r.device_type_id,
    deviceTypeName: r.device_type?.name ?? null,
    companyId: r.company_id,
    companyName: r.company?.company_name ?? null,
    claimed: !!ud,
    userDeviceId: ud?.id ?? null,
    userDeviceStatus: ud?.status ?? null,
    ownerName,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

export async function listInventoryDevices(
  params: InventoryListParams = {},
): Promise<InventoryListResult> {
  const page = Math.max(1, params.page ?? 1)
  const perPage = Math.min(200, Math.max(1, params.perPage ?? 20))
  const from = (page - 1) * perPage
  const to = from + perPage - 1

  const supabase = await createClient()
  let query = supabase.from('inventory_devices').select(SELECT, { count: 'exact' })

  if (params.companyId) query = query.eq('company_id', params.companyId)
  if (params.containerId) query = query.eq('container_id', params.containerId)
  if (params.search?.trim()) {
    const s = params.search.trim().replace(/[%,()]/g, '')
    query = query.or(
      `dev_eui.ilike.%${s}%,xnid.ilike.%${s}%,activation_code.ilike.%${s}%,name.ilike.%${s}%`,
    )
  }

  const { data, count, error } = await query.order('id', { ascending: false }).range(from, to)
  if (error) throw error

  const total = count ?? 0
  return {
    rows: (data ?? []).map((r) => toRow(r as unknown as EmbeddedRow)),
    total,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  }
}

export async function getInventoryDevice(id: number): Promise<InventoryDeviceDetail | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('inventory_devices')
    .select(SELECT)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ? toRow(data as unknown as EmbeddedRow) : null
}

export async function listContainers(): Promise<ContainerRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('containers')
    .select('id, code, inventory_devices(count)')
    .order('code')
  if (error) throw error
  return (data ?? []).map((c) => ({
    id: c.id,
    code: c.code,
    deviceCount:
      (c.inventory_devices as unknown as { count: number }[] | null)?.[0]?.count ?? 0,
  }))
}

/**
 * The gated provisioning read of the LoRaWAN secrets. RLS on
 * `inventory_device_secrets` only lets Super Admin — or an Admin with
 * `inventory` update — select the row, so a caller without that capability
 * simply gets `null` (no row returned), same as a device that has no secrets.
 */
export async function getDeviceSecrets(
  inventoryDeviceId: number,
): Promise<InventoryDeviceSecrets | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('inventory_device_secrets')
    .select('app_key, app_eui, dev_addr, nwkskey, appskey')
    .eq('inventory_device_id', inventoryDeviceId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    appKey: data.app_key,
    appEui: data.app_eui,
    devAddr: data.dev_addr,
    nwkskey: data.nwkskey,
    appskey: data.appskey,
  }
}

// ---------------------------------------------------------------------------
// Safeguard configurations  (SafeGuardConfigurationController)
// ---------------------------------------------------------------------------
export interface SafeguardConfigRow {
  id: number
  userId: string | null
  inventoryDeviceId: number | null
  userDeviceId: number | null
  abnormalAlertLimit: number
  alertIntervalHours: number
  supportEmailSent: string[]
  supportNumberSent: string[]
  isActive: boolean
  notificationsPaused: boolean
  supportEmailSentAt: string | null
  createdAt: string
}

export async function listSafeguardConfigurations(): Promise<SafeguardConfigRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('safeguard_configurations')
    .select(
      'id, user_id, inventory_device_id, user_device_id, abnormal_alert_limit, alert_interval_hours, support_email_sent, support_number_sent, is_active, notifications_paused, support_email_sent_at, created_at',
    )
    .order('id', { ascending: false })
  if (error) throw error
  return (data ?? []).map((c) => ({
    id: c.id,
    userId: c.user_id,
    inventoryDeviceId: c.inventory_device_id,
    userDeviceId: c.user_device_id,
    abnormalAlertLimit: c.abnormal_alert_limit,
    alertIntervalHours: Number(c.alert_interval_hours),
    supportEmailSent: (c.support_email_sent as string[] | null) ?? [],
    supportNumberSent: (c.support_number_sent as string[] | null) ?? [],
    isActive: c.is_active,
    notificationsPaused: c.notifications_paused,
    supportEmailSentAt: c.support_email_sent_at,
    createdAt: c.created_at,
  }))
}

// ---------------------------------------------------------------------------
// Device-health schedulers  (DeviceHealthSchedulerController — own rows only)
// ---------------------------------------------------------------------------
export interface DeviceHealthSchedulerRow {
  id: number
  scheduleTitle: string
  timeZone: string
  time: string
  days: string[]
  selectedDevices: number[]
  createdAt: string
}

export async function listDeviceHealthSchedulers(
  userId: string,
): Promise<DeviceHealthSchedulerRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('device_health_schedulers')
    .select('id, schedule_title, time_zone, time, days, selected_devices, created_at')
    .eq('user_id', userId)
    .order('id', { ascending: false })
  if (error) throw error
  return (data ?? []).map((s) => ({
    id: s.id,
    scheduleTitle: s.schedule_title,
    timeZone: s.time_zone,
    time: s.time,
    days: (s.days as string[] | null) ?? [],
    selectedDevices: (s.selected_devices as number[] | null) ?? [],
    createdAt: s.created_at,
  }))
}

/** Lightweight device pickers for the safeguard / health-scheduler forms. */
export async function getDevicePickerOptions(): Promise<{
  inventoryDevices: { id: number; label: string }[]
  userDevices: { id: number; label: string }[]
}> {
  const supabase = await createClient()
  const [{ data: inv }, { data: ud }] = await Promise.all([
    supabase.from('inventory_devices').select('id, name, dev_eui').order('id').limit(500),
    supabase.from('user_devices').select('id, device_name, dev_eui').order('id').limit(500),
  ])
  return {
    inventoryDevices: (inv ?? []).map((d) => ({
      id: d.id,
      label: `${d.name}${d.dev_eui ? ` · ${d.dev_eui}` : ''}`,
    })),
    userDevices: (ud ?? []).map((d) => ({
      id: d.id,
      label: `${d.device_name ?? `#${d.id}`}${d.dev_eui ? ` · ${d.dev_eui}` : ''}`,
    })),
  }
}

/** Options for the inventory-device create/edit form. */
export async function getInventoryFormOptions(): Promise<{
  containers: { id: number; code: string }[]
  products: { id: number; name: string; deviceTypeId: number | null }[]
  deviceTypes: { id: number; name: string }[]
}> {
  const supabase = await createClient()
  const [{ data: containers }, { data: products }, { data: deviceTypes }] = await Promise.all([
    supabase.from('containers').select('id, code').order('code'),
    supabase.from('products').select('id, product_name, device_type_id').order('product_name'),
    supabase.from('device_types').select('id, name').order('name'),
  ])
  return {
    containers: (containers ?? []).map((c) => ({ id: c.id, code: c.code })),
    products: (products ?? []).map((p) => ({
      id: p.id,
      name: p.product_name ?? `#${p.id}`,
      deviceTypeId: p.device_type_id,
    })),
    deviceTypes: (deviceTypes ?? []).map((d) => ({ id: d.id, name: d.name })),
  }
}
