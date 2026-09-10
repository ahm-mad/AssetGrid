'use server'

import { randomUUID } from 'node:crypto'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { requirePermission } from '@/lib/auth/guards'
import { assignDeviceToOwner } from '@/lib/devices/assign-to-owner'

/**
 * Marina physical-layer mutations — ports `MarinaController` / `DockController` /
 * `SlipController` / `BoatController` store / update / delete + the
 * map-placement PUTs. Perm: `marina,{create|update|delete}`; the FK chain
 * cascades subtree deletes.
 *
 * The old non-idiomatic verbs (`POST marinas/{id}` for update, the `relocate*`
 * PUTs) are kept in the endpoint layer for parity (B2 deferred) — these actions
 * are the new UI's path.
 */

export interface MarinaResult {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string[]>
  id?: number
}

// ---------------------------------------------------------------------------
// marinas
// ---------------------------------------------------------------------------
const marinaSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  marina_name: z.string().trim().max(191).optional().default(''),
  location_code: z.string().trim().min(1).max(191),
  county_code: z.string().trim().min(1).max(191),
  marina_id: z.string().trim().min(1).max(191),
  city_code: z.string().trim().min(1).max(191),
  company_id: z.union([z.coerce.number().int().positive(), z.literal(''), z.null()]).optional(),
  on_net_type: z.string().trim().min(1),
  structure_category: z.string().trim().min(1),
  street_address: z.string().trim().max(2000).optional().default(''),
  city: z.string().trim().max(191).optional().default(''),
  state_province: z.string().trim().max(191).optional().default(''),
  country: z.string().trim().max(191).optional().default(''),
  postal_code: z.string().trim().max(191).optional().default(''),
  latitude: z.union([z.coerce.number(), z.literal(''), z.null()]).optional(),
  longitude: z.union([z.coerce.number(), z.literal(''), z.null()]).optional(),
})

function numOrNull(v: number | '' | null | undefined): number | null {
  return v === '' || v == null ? null : Number(v)
}

export async function saveMarina(input: unknown): Promise<MarinaResult> {
  const hasId = !!(input && (input as { id?: unknown }).id)
  const actor = await requirePermission('marina', hasId ? 'update' : 'create')
  const parsed = marinaSchema.safeParse(input)
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors }
  const v = parsed.data
  const supabase = await createClient()

  // marina_code = location-county-marinaId + cityCode  (Marina::boot)
  const marina_code = `${v.location_code}-${v.county_code}-${v.marina_id}${v.city_code}`
  const row = {
    marina_name: v.marina_name || null,
    location_code: v.location_code,
    county_code: v.county_code,
    marina_id: v.marina_id,
    city_code: v.city_code,
    marina_code,
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
  }

  if (v.id) {
    const { error } = await supabase.from('marinas').update(row).eq('id', v.id)
    if (error) return { ok: false, error: 'Could not update (marina code already used?).' }
    revalidatePath('/app/marina')
    return { ok: true, id: v.id }
  }
  const { data, error } = await supabase.from('marinas').insert(row).select('id').single()
  if (error || !data) return { ok: false, error: 'Could not create (marina code already used?).' }
  revalidatePath('/app/marina')
  return { ok: true, id: data.id }
}

export async function deleteMarina(id: number): Promise<MarinaResult> {
  await requirePermission('marina', 'delete')
  const supabase = await createClient()
  const { error } = await supabase.from('marinas').delete().eq('id', id)
  if (error) return { ok: false, error: 'Could not delete the marina.' }
  revalidatePath('/app/marina')
  return { ok: true }
}

export async function updateMarinaMap(input: {
  id: number
  mapRotation?: number | null
  zoomLevel?: number | null
  uploadedSvg?: string | null
}): Promise<MarinaResult> {
  await requirePermission('marina', 'update')
  const supabase = await createClient()
  const patch: { map_rotation?: number | null; zoom_level?: number | null; uploaded_svg?: string | null } = {}
  if (input.mapRotation !== undefined) patch.map_rotation = input.mapRotation
  if (input.zoomLevel !== undefined) patch.zoom_level = input.zoomLevel
  if (input.uploadedSvg !== undefined) patch.uploaded_svg = input.uploadedSvg
  const { error } = await supabase.from('marinas').update(patch).eq('id', input.id)
  if (error) return { ok: false, error: 'Could not update the map.' }
  revalidatePath(`/app/marina/${input.id}`)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// docks
// ---------------------------------------------------------------------------
export async function saveDock(input: {
  id?: number
  marinaId: number
  name: string
}): Promise<MarinaResult> {
  await requirePermission('marina', input.id ? 'update' : 'create')
  const name = String(input.name ?? '').trim()
  if (!name) return { ok: false, error: 'A dock name is required.' }
  const supabase = await createClient()
  if (input.id) {
    const { error } = await supabase.from('docks').update({ name }).eq('id', input.id)
    if (error) return { ok: false, error: 'Could not update.' }
  } else {
    const { error } = await supabase.from('docks').insert({ name, marina_id: input.marinaId })
    if (error) return { ok: false, error: 'Could not create.' }
  }
  revalidatePath(`/app/marina/${input.marinaId}`)
  return { ok: true }
}

export async function deleteDock(id: number, marinaId: number): Promise<MarinaResult> {
  await requirePermission('marina', 'delete')
  const supabase = await createClient()
  const { error } = await supabase.from('docks').delete().eq('id', id)
  if (error) return { ok: false, error: 'Could not delete.' }
  revalidatePath(`/app/marina/${marinaId}`)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// slips
// ---------------------------------------------------------------------------
const slipSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  dock_id: z.coerce.number().int().positive(),
  marina_id: z.coerce.number().int().positive(),
  name: z.string().trim().min(1).max(191),
  slip_number: z.string().trim().max(191).optional(),
  slip_type: z.string().trim().max(191).optional(),
  slip_status: z.string().trim().max(191).optional(),
  occupancy_status: z.string().trim().max(191).optional(),
  min_loa: z.coerce.number().int().nonnegative().nullable().optional(),
  max_loa: z.coerce.number().int().nonnegative().nullable().optional(),
  depth: z.coerce.number().int().nonnegative().nullable().optional(),
  is_active: z.coerce.boolean().optional().default(true),
})

export async function saveSlip(input: unknown): Promise<MarinaResult> {
  const hasId = !!(input && (input as { id?: unknown }).id)
  await requirePermission('marina', hasId ? 'update' : 'create')
  const parsed = slipSchema.safeParse(input)
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors }
  const v = parsed.data
  const supabase = await createClient()

  const row = {
    dock_id: v.dock_id,
    marina_id: v.marina_id,
    name: v.name,
    slip_number: v.slip_number || null,
    slip_type: v.slip_type || null,
    slip_status: v.slip_status || null,
    occupancy_status: v.occupancy_status || null,
    min_loa: v.min_loa ?? null,
    max_loa: v.max_loa ?? null,
    depth: v.depth ?? null,
    is_active: v.is_active,
  }

  if (v.id) {
    const { error } = await supabase.from('slips').update(row).eq('id', v.id)
    if (error) return { ok: false, error: 'Could not update the slip.' }
  } else {
    const { error } = await supabase.from('slips').insert({ ...row, xnid: `xnid:slip:${randomUUID()}` })
    if (error) return { ok: false, error: 'Could not create the slip.' }
  }
  revalidatePath(`/app/marina/${v.marina_id}`)
  return { ok: true }
}

export async function deleteSlip(id: number, marinaId: number): Promise<MarinaResult> {
  await requirePermission('marina', 'delete')
  const supabase = await createClient()
  const { error } = await supabase.from('slips').delete().eq('id', id)
  if (error) return { ok: false, error: 'Could not delete the slip.' }
  revalidatePath(`/app/marina/${marinaId}`)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// boats  (+ boat_devices, + device claim / provision / xup-pref seed)
// ---------------------------------------------------------------------------
const boatSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  marina_id: z.coerce.number().int().positive(),
  dock_id: z.coerce.number().int().positive().nullable().optional(),
  slip_id: z.coerce.number().int().positive().nullable().optional(),
  user_id: z.string().uuid().nullable().optional(),
  boat_name: z.string().trim().min(1).max(191),
  boat_type: z.string().trim().max(191).optional(),
  boat_model: z.string().trim().max(191).optional(),
  storage_status: z.string().trim().max(30).optional().default('wet'),
  inventory_device_ids: z.array(z.coerce.number().int().positive()).optional().default([]),
  notification_email: z.string().trim().max(255).optional(),
  notification_number: z.string().trim().max(255).optional(),
})

export async function saveBoat(input: unknown): Promise<MarinaResult> {
  const hasId = !!(input && (input as { id?: unknown }).id)
  await requirePermission('marina', hasId ? 'update' : 'create')
  const parsed = boatSchema.safeParse(input)
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors }
  const v = parsed.data
  const supabase = await createClient()

  const row = {
    marina_id: v.marina_id,
    dock_id: v.dock_id ?? null,
    slip_id: v.slip_id ?? null,
    user_id: v.user_id ?? null,
    boat_name: v.boat_name,
    boat_type: v.boat_type || null,
    boat_model: v.boat_model || null,
    storage_status: v.storage_status || 'wet',
  }

  let boatId = v.id ?? null
  if (v.id) {
    const { error } = await supabase.from('boats').update(row).eq('id', v.id)
    if (error) return { ok: false, error: 'Could not update the boat.' }
  } else {
    const { data, error } = await supabase
      .from('boats')
      .insert({ ...row, xnid: `xnid:boat:${randomUUID()}` })
      .select('id')
      .single()
    if (error || !data) return { ok: false, error: 'Could not create the boat.' }
    boatId = data.id
  }
  if (!boatId) return { ok: false, error: 'Boat not found.' }

  // --- sync boat_devices + (optionally) claim/provision each device ---
  const db = createServiceClient()
  const { data: existingLinks } = await db
    .from('boat_devices')
    .select('inventory_device_id')
    .eq('boat_id', boatId)
  const have = new Set((existingLinks ?? []).map((l) => l.inventory_device_id))
  const want = new Set(v.inventory_device_ids)

  const toAdd = [...want].filter((id) => !have.has(id))
  const toRemove = [...have].filter((id) => !want.has(id))

  if (toAdd.length > 0) {
    await db.from('boat_devices').insert(toAdd.map((id) => ({ boat_id: boatId!, inventory_device_id: id })))
  }
  if (toRemove.length > 0) {
    await db
      .from('boat_devices')
      .delete()
      .eq('boat_id', boatId)
      .in('inventory_device_id', toRemove)
  }

  const { data: boat } = await supabase.from('boats').select('xnid, user_id').eq('id', boatId).maybeSingle()
  if (boat?.user_id) {
    const ownerXnid = boat.xnid ?? `xnid:boat:${boatId}`
    for (const invId of toAdd) {
      await assignDeviceToOwner({
        inventoryDeviceId: invId,
        userId: boat.user_id,
        ownerXnid,
        deviceName: v.boat_name,
        notificationEmail: v.notification_email || null,
        notificationPhone: v.notification_number || null,
      })
    }
  }

  revalidatePath(`/app/marina/${v.marina_id}`)
  return { ok: true, id: boatId }
}

export async function deleteBoat(id: number, marinaId: number): Promise<MarinaResult> {
  await requirePermission('marina', 'delete')
  const supabase = await createClient()
  const { error } = await supabase.from('boats').delete().eq('id', id)
  if (error) return { ok: false, error: 'Could not delete the boat.' }
  revalidatePath(`/app/marina/${marinaId}`)
  return { ok: true }
}

/** Move a boat to a slip (or off — `slipId = null` unassigns it). */
export async function assignBoatToSlip(
  boatId: number,
  slipId: number | null,
  marinaId: number,
): Promise<MarinaResult> {
  await requirePermission('marina', 'update')
  const supabase = await createClient()
  const patch: { slip_id: number | null; dock_id?: number | null } = { slip_id: slipId }
  if (slipId != null) {
    const { data: slip } = await supabase.from('slips').select('dock_id').eq('id', slipId).maybeSingle()
    if (slip) patch.dock_id = slip.dock_id
  }
  const { error } = await supabase.from('boats').update(patch).eq('id', boatId)
  if (error) return { ok: false, error: 'Could not move the boat.' }
  revalidatePath(`/app/marina/${marinaId}`)
  return { ok: true }
}
