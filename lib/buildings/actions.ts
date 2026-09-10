'use server'

import { randomUUID } from 'node:crypto'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { requirePermission } from '@/lib/auth/guards'
import { seedUserXupPreferences } from '@/lib/catalog/xup-preferences'
import { provisionDevices } from '@/lib/provisioning/actions'

/**
 * Buildings hierarchy mutations — ports `BuildingController` /
 * `FloorController` / `UnitController` / `AreaController` / `SiteController`
 * store / update / delete. Perm: `buildings,{create|update|delete}`; the FK
 * chain `ON DELETE CASCADE` handles subtree deletion.
 *
 * `saveSite` reproduces `SiteController@store`'s side effects: when a `user_id`
 * is supplied it also claims the device (`user_devices` captured), creates the
 * `device_charging_state`, provisions an admin entitlement (Flow B, reusing
 * `provisionDevices` from slice 4), and seeds `user_xup_preferences`.
 */

export interface BuildingsResult {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string[]>
  id?: number
}

// ---------------------------------------------------------------------------
// buildings
// ---------------------------------------------------------------------------
const buildingSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  location_code: z.string().trim().min(1).max(3),
  county_code: z.string().trim().min(1).max(2),
  building_id: z.string().trim().min(1).max(10),
  city_code: z.string().trim().min(1).max(7),
  company_id: z.union([z.coerce.number().int().positive(), z.literal(''), z.null()]).optional(),
  on_net_type: z.string().trim().min(1),
  structure_category: z.string().trim().min(1),
  street_address: z.string().trim().max(255).optional().default(''),
  city: z.string().trim().max(255).optional().default(''),
  state_province: z.string().trim().max(255).optional().default(''),
  country: z.string().trim().max(255).optional().default(''),
  postal_code: z.string().trim().max(255).optional().default(''),
  latitude: z.union([z.coerce.number().min(-90).max(90), z.literal(''), z.null()]).optional(),
  longitude: z.union([z.coerce.number().min(-180).max(180), z.literal(''), z.null()]).optional(),
  clli_code: z.string().trim().max(255).optional().default(''),
  lata: z.string().trim().max(255).optional().default(''),
  npa: z.string().trim().max(255).optional().default(''),
  nxx: z.string().trim().max(255).optional().default(''),
  noaa: z.string().trim().max(255).optional().default(''),
})

function numOrNull(v: number | '' | null | undefined): number | null {
  return v === '' || v == null ? null : Number(v)
}

export async function saveBuilding(input: unknown): Promise<BuildingsResult> {
  const hasId = !!(input && (input as { id?: unknown }).id)
  const actor = await requirePermission('buildings', hasId ? 'update' : 'create')
  const parsed = buildingSchema.safeParse(input)
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors }
  const v = parsed.data
  const supabase = await createClient()

  // building_code = location_code-county_code-building_id + city_code  (Building::boot)
  const building_code = `${v.location_code}-${v.county_code}-${v.building_id}${v.city_code}`

  const row = {
    location_code: v.location_code,
    county_code: v.county_code,
    building_id: v.building_id,
    city_code: v.city_code,
    building_code,
    company_id: numOrNull(v.company_id) ?? actor.companyId,
    on_net_type: v.on_net_type,
    structure_category: v.structure_category,
    street_address: v.street_address || null,
    city: v.city || null,
    state_province: v.state_province || null,
    country: v.country || null,
    postal_code: v.postal_code || null,
    latitude: numOrNull(v.latitude),
    longitude: numOrNull(v.longitude),
    clli_code: v.clli_code || null,
    lata: v.lata || null,
    npa: v.npa || null,
    nxx: v.nxx || null,
    noaa: v.noaa || null,
  }

  if (v.id) {
    const { error } = await supabase.from('buildings').update(row).eq('id', v.id)
    if (error) return { ok: false, error: 'Could not update (building code already used?).' }
    revalidatePath('/app/buildings')
    return { ok: true, id: v.id }
  }
  const { data, error } = await supabase.from('buildings').insert(row).select('id').single()
  if (error || !data) return { ok: false, error: 'Could not create (building code already used?).' }
  revalidatePath('/app/buildings')
  return { ok: true, id: data.id }
}

export async function deleteBuilding(id: number): Promise<BuildingsResult> {
  await requirePermission('buildings', 'delete')
  const supabase = await createClient()
  const { error } = await supabase.from('buildings').delete().eq('id', id)
  if (error) return { ok: false, error: 'Could not delete the building.' }
  revalidatePath('/app/buildings')
  return { ok: true }
}

// ---------------------------------------------------------------------------
// floors / units / areas  (name + parent id)
// ---------------------------------------------------------------------------
type NodeKind = 'floors' | 'units' | 'areas'
const PARENT: Record<NodeKind, 'building_id' | 'floor_id' | 'unit_id'> = {
  floors: 'building_id',
  units: 'floor_id',
  areas: 'unit_id',
}

export async function saveHierarchyNode(input: {
  kind: NodeKind
  id?: number
  name: string
  parentId: number
}): Promise<BuildingsResult> {
  await requirePermission('buildings', input.id ? 'update' : 'create')
  const name = String(input.name ?? '').trim()
  if (!name) return { ok: false, error: 'A name is required.' }
  const parentId = Number(input.parentId)
  if (!Number.isInteger(parentId)) return { ok: false, error: 'A parent is required.' }
  const supabase = await createClient()

  // Resolve the building_id we denormalise onto floors/units/areas.
  let buildingId = parentId
  if (input.kind === 'units') {
    const { data } = await supabase.from('floors').select('building_id').eq('id', parentId).maybeSingle()
    buildingId = data?.building_id ?? 0
  } else if (input.kind === 'areas') {
    const { data } = await supabase.from('units').select('building_id').eq('id', parentId).maybeSingle()
    buildingId = data?.building_id ?? 0
  }
  if (!buildingId) return { ok: false, error: 'Parent not found.' }

  const parentCol = PARENT[input.kind]
  const row = { name, [parentCol]: parentId, building_id: buildingId } as Record<string, unknown>

  if (input.id) {
    const { error } = await supabase.from(input.kind).update({ name }).eq('id', input.id)
    if (error) return { ok: false, error: 'Could not update.' }
  } else {
    const { error } = await supabase.from(input.kind).insert(row as never)
    if (error) return { ok: false, error: 'Could not create.' }
  }
  revalidatePath('/app/buildings')
  return { ok: true }
}

export async function deleteHierarchyNode(kind: NodeKind, id: number): Promise<BuildingsResult> {
  await requirePermission('buildings', 'delete')
  const supabase = await createClient()
  const { error } = await supabase.from(kind).delete().eq('id', id)
  if (error) return { ok: false, error: 'Could not delete.' }
  revalidatePath('/app/buildings')
  return { ok: true }
}

// ---------------------------------------------------------------------------
// sites  (+ device claim / provision / xup-pref seed)
// ---------------------------------------------------------------------------
const siteSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  building_id: z.coerce.number().int().positive(),
  area_id: z.coerce.number().int().positive(),
  inventory_device_id: z.coerce.number().int().positive(),
  user_id: z.string().uuid().nullable().optional(),
  room_name: z.string().trim().min(1).max(255),
  area_name: z.string().trim().max(255).optional(),
  end_point: z.string().trim().max(255).optional(),
  interface: z.string().trim().max(255).optional(),
  accessory: z.string().trim().max(255).optional(),
  market: z.string().trim().max(255).optional(),
  point: z.string().trim().max(191).optional().default('0'),
  unit_label: z.string().trim().max(191).optional(),
  notification_email: z.string().trim().max(255).optional(),
  notification_number: z.string().trim().max(255).optional(),
})

export async function saveSite(input: unknown): Promise<BuildingsResult> {
  const hasId = !!(input && (input as { id?: unknown }).id)
  await requirePermission('buildings', hasId ? 'update' : 'create')
  const parsed = siteSchema.safeParse(input)
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors }
  const v = parsed.data
  const supabase = await createClient()

  const siteRow = {
    building_id: v.building_id,
    area_id: v.area_id,
    inventory_device_id: v.inventory_device_id,
    user_id: v.user_id ?? null,
    room_name: v.room_name,
    end_point: v.end_point || null,
    interface: v.interface || null,
    accessory: v.accessory || null,
    market: v.market || null,
    point: v.point || '0',
    unit_label: v.unit_label || null,
  }

  if (v.id) {
    const { error } = await supabase.from('sites').update(siteRow).eq('id', v.id)
    if (error) return { ok: false, error: 'Could not update the site.' }
    revalidatePath('/app/buildings')
    return { ok: true, id: v.id }
  }

  // --- create: site + (optionally) device claim / provision / xup seed ---
  const { data: existing } = await supabase
    .from('sites')
    .select('id')
    .eq('inventory_device_id', v.inventory_device_id)
    .maybeSingle()
  if (existing) return { ok: false, error: 'That inventory device already has a site.' }

  const xnid = `xnid:site:${randomUUID()}`
  const { data: site, error } = await supabase
    .from('sites')
    .insert({ ...siteRow, xnid })
    .select('id')
    .single()
  if (error || !site) return { ok: false, error: 'Could not create the site.' }

  if (v.user_id) {
    const db = createServiceClient()
    const { data: inv } = await db
      .from('inventory_devices')
      .select('id, dev_eui, activation_code, product_id')
      .eq('id', v.inventory_device_id)
      .maybeSingle()

    const { data: existingUd } = await db
      .from('user_devices')
      .select('id')
      .eq('user_id', v.user_id)
      .eq('inventory_device_id', v.inventory_device_id)
      .maybeSingle()

    let userDeviceId = existingUd?.id ?? null
    if (!userDeviceId && inv) {
      const { data: ud } = await db
        .from('user_devices')
        .insert({
          xnid: `xnid:user_device:${randomUUID()}`,
          user_id: v.user_id,
          inventory_device_id: inv.id,
          dev_eui: inv.dev_eui,
          status: 'captured',
          device_name: v.room_name,
          device_activation_code: inv.activation_code,
          notification_email: v.notification_email || null,
          notification_phone_number: v.notification_number || null,
          device_location: v.area_name || null,
        })
        .select('id')
        .single()
      userDeviceId = ud?.id ?? null

      if (userDeviceId) {
        await db.from('device_charging_state').upsert(
          {
            user_device_id: userDeviceId,
            dev_eui: inv.dev_eui,
            user_id: v.user_id,
            inventory_device_id: inv.id,
            is_on: false,
          },
          { onConflict: 'user_device_id' },
        )
      }
    }

    if (userDeviceId) {
      await provisionDevices({
        user_id: v.user_id,
        user_device_ids: [userDeviceId],
        owner_xnid: xnid,
      })
    }
    if (inv?.product_id) {
      await seedUserXupPreferences(db, { userId: v.user_id, productId: inv.product_id })
    }
  }

  revalidatePath('/app/buildings')
  return { ok: true, id: site.id }
}

export async function deleteSite(id: number): Promise<BuildingsResult> {
  await requirePermission('buildings', 'delete')
  const supabase = await createClient()
  const { error } = await supabase.from('sites').delete().eq('id', id)
  if (error) return { ok: false, error: 'Could not delete the site.' }
  revalidatePath('/app/buildings')
  return { ok: true }
}
