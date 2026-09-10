import 'server-only'

import { createClient } from '@/utils/supabase/server'

/**
 * Buildings hierarchy reads — ports `BuildingController@index` / `@list` /
 * `@getBuildingById` / `@getBuildings` and `SiteController@getSiteById`.
 * The old app has several near-duplicate list endpoints (`list`, `list-count`,
 * `building-list`, `name`) — one `listBuildings()` covers them, RLS does the
 * `building` scope.
 */

export interface SiteNode {
  id: number
  xnid: string | null
  roomName: string
  point: string
  areaId: number
  userId: string | null
  inventoryDeviceId: number | null
  inventoryDeviceName: string | null
  devEui: string | null
}

export interface AreaNode {
  id: number
  name: string
  unitId: number
  sites: SiteNode[]
}
export interface UnitNode {
  id: number
  name: string
  floorId: number
  areas: AreaNode[]
}
export interface FloorNode {
  id: number
  name: string
  buildingId: number
  units: UnitNode[]
}
export interface BuildingRow {
  id: number
  buildingCode: string
  companyId: number | null
  companyName: string | null
  onNetType: string
  structureCategory: string
  locationCode: string
  countyCode: string
  buildingIdCode: string
  cityCode: string
  streetAddress: string | null
  city: string | null
  stateProvince: string | null
  country: string | null
  postalCode: string | null
  latitude: number | null
  longitude: number | null
  siteCount: number
}
export interface BuildingTree extends BuildingRow {
  floors: FloorNode[]
}

const BUILDING_COLS =
  'id, building_code, company_id, on_net_type, structure_category, location_code, county_code, building_id, city_code, street_address, city, state_province, country, postal_code, latitude, longitude, company:companies(company_name), sites(count)'

function toBuilding(b: Record<string, unknown>): BuildingRow {
  return {
    id: b.id as number,
    buildingCode: b.building_code as string,
    companyId: (b.company_id as number | null) ?? null,
    companyName: (b.company as { company_name?: string } | null)?.company_name ?? null,
    onNetType: (b.on_net_type as string) ?? '',
    structureCategory: (b.structure_category as string) ?? '',
    locationCode: b.location_code as string,
    countyCode: b.county_code as string,
    buildingIdCode: b.building_id as string,
    cityCode: b.city_code as string,
    streetAddress: (b.street_address as string | null) ?? null,
    city: (b.city as string | null) ?? null,
    stateProvince: (b.state_province as string | null) ?? null,
    country: (b.country as string | null) ?? null,
    postalCode: (b.postal_code as string | null) ?? null,
    latitude: (b.latitude as number | null) ?? null,
    longitude: (b.longitude as number | null) ?? null,
    siteCount: ((b.sites as { count: number }[] | null) ?? [])[0]?.count ?? 0,
  }
}

export async function listBuildings(): Promise<BuildingRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('buildings').select(BUILDING_COLS).order('building_code')
  if (error) throw error
  return (data ?? []).map((b) => toBuilding(b as Record<string, unknown>))
}

export async function getBuildingOptions(): Promise<{ id: number; code: string }[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('buildings').select('id, building_code').order('building_code')
  return (data ?? []).map((b) => ({ id: b.id, code: b.building_code }))
}

export async function getBuilding(id: number): Promise<BuildingTree | null> {
  const supabase = await createClient()
  const { data: b, error } = await supabase
    .from('buildings')
    .select(BUILDING_COLS)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!b) return null

  const [{ data: floors }, { data: units }, { data: areas }, { data: sites }] = await Promise.all([
    supabase.from('floors').select('id, name, building_id').eq('building_id', id).order('id'),
    supabase.from('units').select('id, name, floor_id, building_id').eq('building_id', id).order('id'),
    supabase.from('areas').select('id, name, unit_id, building_id').eq('building_id', id).order('id'),
    supabase
      .from('sites')
      .select(
        'id, xnid, room_name, point, area_id, user_id, inventory_device_id, inventory_device:inventory_devices(name, dev_eui)',
      )
      .eq('building_id', id)
      .order('id'),
  ])

  const siteNodes: SiteNode[] = (sites ?? []).map((s) => ({
    id: s.id,
    xnid: s.xnid,
    roomName: s.room_name,
    point: s.point,
    areaId: s.area_id,
    userId: s.user_id,
    inventoryDeviceId: s.inventory_device_id,
    inventoryDeviceName: (s.inventory_device as { name?: string } | null)?.name ?? null,
    devEui: (s.inventory_device as { dev_eui?: string | null } | null)?.dev_eui ?? null,
  }))
  const sitesByArea = groupBy(siteNodes, (s) => s.areaId)

  const areaNodes: AreaNode[] = (areas ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    unitId: a.unit_id,
    sites: sitesByArea.get(a.id) ?? [],
  }))
  const areasByUnit = groupBy(areaNodes, (a) => a.unitId)

  const unitNodes: UnitNode[] = (units ?? []).map((u) => ({
    id: u.id,
    name: u.name,
    floorId: u.floor_id,
    areas: areasByUnit.get(u.id) ?? [],
  }))
  const unitsByFloor = groupBy(unitNodes, (u) => u.floorId)

  const floorNodes: FloorNode[] = (floors ?? []).map((f) => ({
    id: f.id,
    name: f.name,
    buildingId: f.building_id,
    units: unitsByFloor.get(f.id) ?? [],
  }))

  return { ...toBuilding(b as Record<string, unknown>), floors: floorNodes }
}

export async function getSite(id: number): Promise<
  | (SiteNode & {
      buildingId: number
      buildingCode: string | null
      lastReading: Record<string, unknown> | null
      lastReadingAt: string | null
      userDeviceId: number | null
    })
  | null
> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('sites')
    .select(
      'id, xnid, room_name, point, area_id, user_id, inventory_device_id, building_id, building:buildings(building_code), inventory_device:inventory_devices(name, dev_eui)',
    )
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null

  let lastReading: Record<string, unknown> | null = null
  let lastReadingAt: string | null = null
  let userDeviceId: number | null = null
  if (data.inventory_device_id) {
    const { data: ud } = await supabase
      .from('user_devices')
      .select('id, last_reading, last_reading_at')
      .eq('inventory_device_id', data.inventory_device_id)
      .order('id')
      .limit(1)
      .maybeSingle()
    if (ud) {
      userDeviceId = ud.id
      lastReading = (ud.last_reading as Record<string, unknown> | null) ?? null
      lastReadingAt = ud.last_reading_at
    }
  }

  return {
    id: data.id,
    xnid: data.xnid,
    roomName: data.room_name,
    point: data.point,
    areaId: data.area_id,
    userId: data.user_id,
    inventoryDeviceId: data.inventory_device_id,
    inventoryDeviceName: (data.inventory_device as { name?: string } | null)?.name ?? null,
    devEui: (data.inventory_device as { dev_eui?: string | null } | null)?.dev_eui ?? null,
    buildingId: data.building_id,
    buildingCode: (data.building as { building_code?: string } | null)?.building_code ?? null,
    lastReading,
    lastReadingAt,
    userDeviceId,
  }
}

function groupBy<T, K>(items: T[], key: (t: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>()
  for (const it of items) {
    const k = key(it)
    const arr = m.get(k)
    if (arr) arr.push(it)
    else m.set(k, [it])
  }
  return m
}
