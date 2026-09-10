import 'server-only'

import { createClient } from '@/utils/supabase/server'

/**
 * Marina physical-layer reads — ports the `marinas`/`docks`/`slips`/`boats`
 * read endpoints (`MarinaController` / `DockController` / `SlipController` /
 * `BoatController`, `api-inventory.md` §4.9). One `listMarinas()` covers the
 * old `list` / `list-count` / `marina-list` / `name` near-dupes; RLS does the
 * `marina` scope. The PMS chain is slice 8.
 */

export interface MarinaRow {
  id: number
  marinaName: string | null
  marinaCode: string
  companyId: number | null
  companyName: string | null
  onNetType: string
  structureCategory: string
  city: string | null
  stateProvince: string | null
  country: string | null
  hasSvg: boolean
  dockCount: number
  slipCount: number
  boatCount: number
}

export interface BoatNode {
  id: number
  xnid: string | null
  boatName: string
  boatType: string | null
  slipId: number | null
  dockId: number | null
  userId: string | null
  isAssigned: boolean
  deviceCount: number
  storageStatus: string | null
}
export interface SlipNode {
  id: number
  name: string
  slipNumber: string | null
  slipStatus: string | null
  occupancyStatus: string | null
  isActive: boolean
  minLoa: number | null
  maxLoa: number | null
  boats: BoatNode[]
}
export interface DockNode {
  id: number
  name: string
  slips: SlipNode[]
}
export interface MarinaTree extends MarinaRow {
  uploadedSvg: string | null
  mapRotation: number | null
  zoomLevel: number | null
  docks: DockNode[]
  unassignedBoats: BoatNode[]
}

const MARINA_COLS =
  'id, marina_name, marina_code, company_id, on_net_type, structure_category, city, state_province, country, uploaded_svg, map_rotation, zoom_level, company:companies(company_name), docks(count), slips(count), boats(count)'

function toMarina(m: Record<string, unknown>): MarinaRow {
  const cnt = (k: string) => ((m[k] as { count: number }[] | null) ?? [])[0]?.count ?? 0
  return {
    id: m.id as number,
    marinaName: (m.marina_name as string | null) ?? null,
    marinaCode: m.marina_code as string,
    companyId: (m.company_id as number | null) ?? null,
    companyName: (m.company as { company_name?: string } | null)?.company_name ?? null,
    onNetType: (m.on_net_type as string) ?? '',
    structureCategory: (m.structure_category as string) ?? '',
    city: (m.city as string | null) ?? null,
    stateProvince: (m.state_province as string | null) ?? null,
    country: (m.country as string | null) ?? null,
    hasSvg: !!m.uploaded_svg,
    dockCount: cnt('docks'),
    slipCount: cnt('slips'),
    boatCount: cnt('boats'),
  }
}

export async function listMarinas(): Promise<MarinaRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('marinas').select(MARINA_COLS).order('marina_code')
  if (error) throw error
  return (data ?? []).map((m) => toMarina(m as Record<string, unknown>))
}

export async function getMarinaOptions(): Promise<{ id: number; code: string }[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('marinas').select('id, marina_code').order('marina_code')
  return (data ?? []).map((m) => ({ id: m.id, code: m.marina_code }))
}

export async function getMarina(id: number): Promise<MarinaTree | null> {
  const supabase = await createClient()
  const { data: m, error } = await supabase.from('marinas').select(MARINA_COLS).eq('id', id).maybeSingle()
  if (error) throw error
  if (!m) return null

  const [{ data: docks }, { data: slips }, { data: boats }] = await Promise.all([
    supabase.from('docks').select('id, name, marina_id').eq('marina_id', id).order('id'),
    supabase
      .from('slips')
      .select(
        'id, name, slip_number, slip_status, occupancy_status, is_active, min_loa, max_loa, dock_id',
      )
      .eq('marina_id', id)
      .order('id'),
    supabase
      .from('boats')
      .select(
        'id, xnid, boat_name, boat_type, slip_id, dock_id, user_id, is_assigned, storage_status, boat_devices(count)',
      )
      .eq('marina_id', id)
      .order('id'),
  ])

  const boatNodes: BoatNode[] = (boats ?? []).map((b) => ({
    id: b.id,
    xnid: b.xnid,
    boatName: b.boat_name,
    boatType: b.boat_type,
    slipId: b.slip_id,
    dockId: b.dock_id,
    userId: b.user_id,
    isAssigned: b.is_assigned ?? false,
    deviceCount: ((b.boat_devices as { count: number }[] | null) ?? [])[0]?.count ?? 0,
    storageStatus: b.storage_status,
  }))
  const boatsBySlip = new Map<number, BoatNode[]>()
  const unassignedBoats: BoatNode[] = []
  for (const bn of boatNodes) {
    if (bn.slipId == null) unassignedBoats.push(bn)
    else {
      const arr = boatsBySlip.get(bn.slipId)
      if (arr) arr.push(bn)
      else boatsBySlip.set(bn.slipId, [bn])
    }
  }

  const slipNodes: SlipNode[] = (slips ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    slipNumber: s.slip_number,
    slipStatus: s.slip_status,
    occupancyStatus: s.occupancy_status,
    isActive: s.is_active,
    minLoa: s.min_loa,
    maxLoa: s.max_loa,
    boats: boatsBySlip.get(s.id) ?? [],
  }))
  const slipsByDock = new Map<number, SlipNode[]>()
  for (const sn of (slips ?? []).map((s, i) => ({ dockId: s.dock_id, node: slipNodes[i] }))) {
    const arr = slipsByDock.get(sn.dockId)
    if (arr) arr.push(sn.node)
    else slipsByDock.set(sn.dockId, [sn.node])
  }

  const dockNodes: DockNode[] = (docks ?? []).map((d) => ({
    id: d.id,
    name: d.name,
    slips: slipsByDock.get(d.id) ?? [],
  }))

  const base = toMarina(m as Record<string, unknown>)
  return {
    ...base,
    uploadedSvg: (m.uploaded_svg as string | null) ?? null,
    mapRotation: (m.map_rotation as number | null) ?? null,
    zoomLevel: (m.zoom_level as number | null) ?? null,
    docks: dockNodes,
    unassignedBoats,
  }
}

export async function getBoat(id: number): Promise<
  | (BoatNode & {
      marinaId: number
      marinaCode: string | null
      deviceIds: number[]
      lastReadings: { inventoryDeviceId: number; reading: Record<string, unknown> | null; at: string | null }[]
    })
  | null
> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('boats')
    .select(
      'id, xnid, boat_name, boat_type, slip_id, dock_id, user_id, is_assigned, storage_status, marina_id, marina:marinas(marina_code), boat_devices(inventory_device_id)',
    )
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null

  const deviceIds = ((data.boat_devices as { inventory_device_id: number }[] | null) ?? []).map(
    (d) => d.inventory_device_id,
  )
  const lastReadings: {
    inventoryDeviceId: number
    reading: Record<string, unknown> | null
    at: string | null
  }[] = []
  if (deviceIds.length > 0) {
    const { data: uds } = await supabase
      .from('user_devices')
      .select('inventory_device_id, last_reading, last_reading_at')
      .in('inventory_device_id', deviceIds)
    for (const ud of uds ?? []) {
      lastReadings.push({
        inventoryDeviceId: ud.inventory_device_id as number,
        reading: (ud.last_reading as Record<string, unknown> | null) ?? null,
        at: ud.last_reading_at,
      })
    }
  }

  return {
    id: data.id,
    xnid: data.xnid,
    boatName: data.boat_name,
    boatType: data.boat_type,
    slipId: data.slip_id,
    dockId: data.dock_id,
    userId: data.user_id,
    isAssigned: data.is_assigned ?? false,
    deviceCount: deviceIds.length,
    storageStatus: data.storage_status,
    marinaId: data.marina_id,
    marinaCode: (data.marina as { marina_code?: string } | null)?.marina_code ?? null,
    deviceIds,
    lastReadings,
  }
}
