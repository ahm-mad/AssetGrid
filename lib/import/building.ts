import 'server-only'

import { createServiceClient } from '@/utils/supabase/service'

import { buildUserLookup } from './lookup'
import { provisionImportedDevice } from './provision'
import { cell, missingColumn, parseCsv, writeErrorReport, type ImportOutcome, type RowError } from './parse'

/**
 * `ImportController@importbuilding`. Rows are grouped by building_code; a row
 * with no `Unit` value defines a floor, a row with a `Unit` value defines a
 * unit → area → site (+ device capture + xUP preference seed). `floorName` is
 * carried across rows (the old loop keeps it in a local).
 */

const REQUIRED = [
  'Floor',
  'Name',
  'Unit',
  'Room',
  'Area',
  'End-Point',
  'Interface',
  'Accessory',
  'xNID',
  'building_code',
  'CustomerEmail',
]

export async function importBuilding(file: File | Blob): Promise<ImportOutcome> {
  const parsed = await parseCsv(file)
  if (!parsed.ok) return fail(parsed.error ?? 'Could not read the CSV.')
  const missing = missingColumn(parsed.header, REQUIRED)
  if (missing) return fail(`Missing required column: ${missing}`)
  if (parsed.rows.length === 0) return fail('CSV file contains no data rows.')

  const db = createServiceClient()
  const users = await buildUserLookup(db)
  const errors: RowError[] = []
  const warnings: string[] = []
  let imported = 0
  let skipped = 0

  let buildingCode: string | null = null
  let buildingId: number | null = null
  let buildingCountry: string | null = null
  let floorName: string | null = null

  for (let i = 0; i < parsed.rows.length; i += 1) {
    const rowNo = i + 1
    const row = parsed.rows[i]
    try {
      const code = cell(row, 'building_code')
      if (buildingCode !== code) {
        const { data: building } = await db
          .from('buildings')
          .select('id, country')
          .eq('building_code', code)
          .maybeSingle()
        if (!building) {
          skipped += 1
          errors.push({ row: rowNo, message: `Building code ${code} not found.` })
          continue
        }
        buildingCode = code
        buildingId = building.id
        buildingCountry = building.country ?? null
      }
      if (buildingId == null) {
        skipped += 1
        errors.push({ row: rowNo, message: 'No building resolved for this row.' })
        continue
      }

      const floorLabel = `${cell(row, 'Floor')} ${cell(row, 'Name')}`.trim()

      if (!cell(row, 'Unit')) {
        // floor-only row
        const floor = await upsertFloor(db, floorLabel, buildingId)
        floorName = floor.name
        imported += 1
        continue
      }

      // unit → area → site row
      let floorId: number | null = null
      if (floorName) {
        const { data: f } = await db.from('floors').select('id').eq('name', floorName).maybeSingle()
        floorId = f?.id ?? null
      }
      if (floorId == null) {
        const floor = await upsertFloor(db, floorLabel, buildingId)
        floorName = floor.name
        floorId = floor.id
      }

      const unit = await firstOrCreate(
        db,
        'units',
        { floor_id: floorId, name: cell(row, 'Room') },
        { building_id: buildingId },
      )
      const area = await firstOrCreate(
        db,
        'areas',
        { unit_id: unit.id, name: cell(row, 'Name') },
        { building_id: buildingId },
      )

      const xnid = cell(row, 'xNID')
      const { data: invDevice } = await db
        .from('inventory_devices')
        .select('id, product_id, activation_code, dev_eui')
        .eq('xnid', xnid)
        .maybeSingle()
      if (!invDevice) {
        skipped += 1
        errors.push({ row: rowNo, message: `Inventory device with xNID ${xnid} not found.` })
        continue
      }

      const customerEmail = cell(row, 'CustomerEmail').toLowerCase()
      const user = users.byEmail.get(customerEmail)
      if (!user) {
        skipped += 1
        errors.push({ row: rowNo, message: `Customer with email ${customerEmail} not found.` })
        continue
      }

      const roomName = `${cell(row, 'Area')} ${cell(row, 'End-Point')}`.trim()
      await db.from('sites').upsert(
        {
          inventory_device_id: invDevice.id,
          room_name: roomName || 'Site',
          interface: cell(row, 'Interface') || null,
          accessory: cell(row, 'Accessory') || null,
          end_point: cell(row, 'End-Point') || null,
          building_id: buildingId,
          area_id: area.id,
          user_id: user.userId,
        },
        { onConflict: 'inventory_device_id' },
      )

      await provisionImportedDevice(db, {
        inventoryDeviceId: invDevice.id,
        userId: user.userId,
        deviceName: roomName || null,
        deviceLocation: buildingCountry,
        notificationEmail: customerEmail,
      })

      imported += 1
    } catch (e) {
      skipped += 1
      errors.push({ row: rowNo, message: (e as Error).message })
    }
  }

  const errorReportUrl = await writeErrorReport('building', errors, warnings)
  return {
    ok: imported > 0,
    inserted: imported,
    updated: 0,
    skipped,
    warnings,
    errors,
    errorReportUrl,
    message: `Building import completed. Imported: ${imported}, skipped: ${skipped}.`,
  }
}

async function upsertFloor(
  db: ReturnType<typeof createServiceClient>,
  name: string,
  buildingId: number,
): Promise<{ id: number; name: string }> {
  const { data: existing } = await db.from('floors').select('id, name').eq('name', name).maybeSingle()
  if (existing) {
    await db.from('floors').update({ building_id: buildingId }).eq('id', existing.id)
    return existing
  }
  const { data: created } = await db
    .from('floors')
    .insert({ name, building_id: buildingId })
    .select('id, name')
    .single()
  return created ?? { id: 0, name }
}

async function firstOrCreate(
  db: ReturnType<typeof createServiceClient>,
  table: 'units' | 'areas',
  match: Record<string, unknown>,
  createExtra: Record<string, unknown> = {},
): Promise<{ id: number }> {
  let query = db.from(table).select('id')
  for (const [k, v] of Object.entries(match)) query = query.eq(k, v as never)
  const { data: existing } = await query.maybeSingle()
  if (existing) return existing
  const { data: created } = await db
    .from(table)
    .insert({ ...match, ...createExtra } as never)
    .select('id')
    .single()
  return created ?? { id: 0 }
}

function fail(message: string): ImportOutcome {
  return { ok: false, inserted: 0, updated: 0, skipped: 0, warnings: [], errors: [], errorReportUrl: null, message }
}
