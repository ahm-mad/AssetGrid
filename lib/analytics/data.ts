import 'server-only'

import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'

/**
 * Inventory diagnostics — ports `HomeController@analytics` +
 * `InventoryAnalyticsService` (the admin "Diagnostics" dashboard,
 * `GET /api/user-analytics`). The old code fetched every scoped device, ran a
 * per-device Mongo lookup (N+1), then paginated in PHP; this is one
 * RLS-scoped, SQL-paginated query. Scope is entirely RLS on `inventory_devices`
 * (Super Admin / `inventory` read within data-scope / customer owns a
 * user_device) — no manual role branching (ADR-013 pattern).
 *
 * "Latest packet" comes from `user_devices.last_reading` jsonb (ADR-022 — not a
 * `telemetry` scan); alert / malfunction / bypass state from `alert_state`
 * (was `xup_notification_info`). Both are empty until live ingestion / the ETL,
 * so those fields are null/0 for now — the join shape is what matters.
 *
 * Deep relational search (owner email, building code, …) and the exact xUP
 * threshold classification the old `classifyDeviceValues` did are a
 * post-parity refinement (tech-debt B54); direct-column search + the
 * alert_state flags are implemented.
 */

export interface DeviceDiagnosticRow {
  deveui: string | null
  email: string | null
  xnid: string | null
  companyName: string | null
  placeInfo: string
  productId: number | null
  productName: string | null
  notifiName: string | null
  notifiId: number | null
  attributeIds: number[]
  appName: string | null
  userDeviceId: number | null
  inventoryDeviceId: number
  alertCount: number
  normalCount: number
  totalPackets: number
  latestPacket: Record<string, unknown> | null
  malfunction: boolean
  bypassActive: boolean
  malfunctionActiveStatus: string
  malfunctionAttributes: string[]
  xupJsonBody: Record<string, unknown> | null
}

export interface Paginated<T> {
  rows: T[]
  total: number
  page: number
  perPage: number
  totalPages: number
}

const SELECT =
  'id, dev_eui, xnid, name, activation_code, company_id, product_id, company:companies(company_name), product:products(id, product_name, app_id, notifie_id, app:apps(app_name), notifie:notifies(id, name, attributes(id, subject))), user_devices!inner(id, user_id, device_name, device_location, last_reading, status, owner:profiles!user_devices_user_id_fkey(first_name, last_name, xnid, company:companies(company_name))), sites(room_name, building_id, area:areas(name), building:buildings(building_code, street_address)), boat_devices(boat:boats(boat_name, marina_id, marina:marinas(location_code))), alert_state(is_alert, notifications_paused, paused_until, admin_bypass, attribute:attributes(subject))'

interface Row {
  id: number
  dev_eui: string | null
  xnid: string | null
  name: string | null
  activation_code: string | null
  company_id: number | null
  product_id: number | null
  company: { company_name: string | null } | null
  product: {
    id: number
    product_name: string | null
    app_id: number | null
    notifie_id: number | null
    app: { app_name: string | null } | null
    notifie: { id: number; name: string | null; attributes: { id: number; subject: string | null }[] } | null
  } | null
  user_devices: {
    id: number
    user_id: string | null
    device_name: string | null
    device_location: string | null
    last_reading: Record<string, unknown> | null
    status: string
    owner: {
      first_name: string | null
      last_name: string | null
      xnid: string | null
      company: { company_name: string | null } | null
    } | null
  }[]
  sites: {
    room_name: string
    area: { name: string } | null
    building: { building_code: string | null; street_address: string | null } | null
  }[]
  boat_devices: { boat: { boat_name: string | null; marina: { location_code: string | null } | null } | null }[]
  alert_state: {
    is_alert: boolean
    notifications_paused: boolean
    paused_until: string | null
    admin_bypass: boolean
    attribute: { subject: string | null } | null
  }[]
}

export async function listDeviceDiagnostics(params: {
  page?: number
  perPage?: number
  companyId?: number
  buildingId?: number
  marinaId?: number
  search?: string
  alert?: 'true' | 'false'
  malfunction?: 'true' | 'false'
} = {}): Promise<Paginated<DeviceDiagnosticRow>> {
  const page = Math.max(1, params.page ?? 1)
  const perPage = Math.min(500, Math.max(1, params.perPage ?? 10))
  const from = (page - 1) * perPage

  const supabase = await createClient()
  let query = supabase.from('inventory_devices').select(SELECT, { count: 'exact' })
  if (params.companyId != null) query = query.eq('company_id', params.companyId)
  // building / marina narrowing filters the embedded rows (a device with no
  // matching site/boat then produces an empty place_info); exact parent-row
  // restriction on an embed is tracked in tech-debt B54.
  if (params.buildingId != null) query = query.eq('sites.building_id', params.buildingId)
  if (params.marinaId != null) query = query.eq('boat_devices.boat.marina_id', params.marinaId)
  if (params.search) {
    const s = params.search.replace(/[%,()]/g, '')
    query = query.or(
      `dev_eui.ilike.%${s}%,xnid.ilike.%${s}%,name.ilike.%${s}%,activation_code.ilike.%${s}%`,
    )
  }

  const { data, count, error } = await query
    .order('id', { ascending: false })
    .range(from, from + perPage - 1)
  if (error) throw error

  // captured user_devices only (the !inner embed keeps rows that have one; this
  // trims a row whose only user_device is not captured)
  const rowsRaw = (data ?? []) as unknown as Row[]
  const captured = rowsRaw
    .map((r) => {
      const uds = Array.isArray(r.user_devices) ? r.user_devices : r.user_devices ? [r.user_devices] : []
      return { r, ud: uds.find((u) => u.status === 'captured') ?? uds[0] }
    })
    .filter((x): x is { r: Row; ud: Row['user_devices'][number] } => x.ud != null)

  // page-scoped email lookup (profiles carries no email — auth.users does)
  const userIds = [...new Set(captured.map((x) => x.ud.user_id).filter((v): v is string => !!v))]
  const emailById = new Map<string, string>()
  if (userIds.length > 0) {
    const admin = createServiceClient()
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    for (const u of list?.users ?? []) if (u.email && userIds.includes(u.id)) emailById.set(u.id, u.email)
  }

  let rows = captured.map(({ r, ud }) => toDiagnosticRow(r, ud, emailById))

  if (params.alert === 'true') rows = rows.filter((x) => x.alertCount > 0)
  if (params.alert === 'false') rows = rows.filter((x) => x.alertCount === 0)
  if (params.malfunction === 'true') rows = rows.filter((x) => x.malfunction)
  if (params.malfunction === 'false') rows = rows.filter((x) => !x.malfunction)

  const total = count ?? rows.length
  return { rows, total, page, perPage, totalPages: Math.max(1, Math.ceil(total / perPage)) }
}

/** PostgREST returns a to-one embed as an object-or-null and a to-many as an array. */
function arr<T>(v: T | T[] | null | undefined): T[] {
  return v == null ? [] : Array.isArray(v) ? v : [v]
}

function toDiagnosticRow(
  r: Row,
  ud: Row['user_devices'][number],
  emailById: Map<string, string>,
): DeviceDiagnosticRow {
  const owner = Array.isArray(ud.owner) ? (ud.owner[0] ?? null) : ud.owner
  const site = arr(r.sites)[0] ?? null
  const boat = arr(r.boat_devices)
    .map((b) => b.boat)
    .find((b) => b != null) ?? null

  let placeInfo = ''
  if (owner) {
    if (site) {
      placeInfo = [site.room_name, site.area?.name, site.building?.building_code, site.building?.street_address]
        .filter(Boolean)
        .join(', ')
    } else if (boat) {
      placeInfo = [ud.device_name, ud.device_location, boat.boat_name, boat.marina?.location_code]
        .filter(Boolean)
        .join(', ')
    } else {
      placeInfo = [ud.device_name, ud.device_location].filter(Boolean).join(', ')
    }
  }

  const now = Date.now()
  const alertRows = arr(r.alert_state)
  const alertCount = alertRows.filter((a) => a.is_alert).length
  const pausedRows = alertRows.filter(
    (a) => a.notifications_paused && a.paused_until && new Date(a.paused_until).getTime() > now,
  )
  const bypassActive = alertRows.some((a) => a.admin_bypass)

  return {
    deveui: r.dev_eui,
    email: ud.user_id ? (emailById.get(ud.user_id) ?? null) : null,
    xnid: r.xnid,
    companyName: owner?.company?.company_name ?? r.company?.company_name ?? null,
    placeInfo,
    productId: r.product?.id ?? null,
    productName: r.product?.product_name ?? null,
    notifiName: r.product?.notifie?.name ?? null,
    notifiId: r.product?.notifie?.id ?? null,
    attributeIds: (r.product?.notifie?.attributes ?? []).map((a) => a.id),
    appName: r.product?.app?.app_name ?? null,
    userDeviceId: ud.id,
    inventoryDeviceId: r.id,
    alertCount,
    normalCount: Math.max(0, (r.product?.notifie?.attributes?.length ?? 0) - alertCount),
    totalPackets: ud.last_reading ? 1 : 0,
    latestPacket: ud.last_reading,
    malfunction: pausedRows.length > 0,
    bypassActive,
    malfunctionActiveStatus: bypassActive ? 'bypassed' : 'global safeguarded',
    malfunctionAttributes: [
      ...new Set(pausedRows.map((a) => a.attribute?.subject).filter((s): s is string => !!s)),
    ],
    xupJsonBody: ud.last_reading,
  }
}
