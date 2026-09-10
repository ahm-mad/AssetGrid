import 'server-only'

import { randomUUID } from 'node:crypto'

import { createServiceClient } from '@/utils/supabase/service'

import { buildUserLookup } from './lookup'
import { provisionImportedDevice } from './provision'
import {
  cell,
  missingColumn,
  optCell,
  parseCsv,
  writeErrorReport,
  type ImportOutcome,
  type ImportRow,
  type RowError,
} from './parse'

/**
 * `ImportController@importMarina` — three independent layers per row:
 *   1 (always):   Marina → Dock → Slip
 *   2 (optional): Customer / Boat / Reservation → Assignment → Stay
 *   3 (optional): device capture (`user_devices` + charging state + xUP prefs)
 * Missing customer / device data downgrades to a warning, not a skip.
 */

const REQUIRED = ['marina_code', 'Dock Name', 'Slip Name/ID', 'Slip Status']

export async function importMarina(file: File | Blob): Promise<ImportOutcome> {
  const parsed = await parseCsv(file)
  if (!parsed.ok) return fail(parsed.error ?? 'Could not read the CSV.')
  const missing = missingColumn(parsed.header, REQUIRED)
  if (missing) return fail(`Missing required column: ${missing}`)
  if (parsed.rows.length === 0) return fail('CSV file contains no data rows.')

  const db = createServiceClient()
  const users = await buildUserLookup(db)
  const marinaCache = new Map<string, { id: number } | null>()
  const errors: RowError[] = []
  const warnings: string[] = []
  let imported = 0
  let skipped = 0

  for (let i = 0; i < parsed.rows.length; i += 1) {
    const rowNo = i + 2 // header is line 1
    const row = parsed.rows[i]
    try {
      // ---- Layer 1 -------------------------------------------------------
      const marinaCode = cell(row, 'marina_code')
      const dockName = cell(row, 'Dock Name')
      const slipName = cell(row, 'Slip Name/ID')
      if (!marinaCode || !dockName || !slipName) {
        skipped += 1
        errors.push({ row: rowNo, message: 'marina_code, Dock Name or Slip Name/ID is empty.' })
        continue
      }

      if (!marinaCache.has(marinaCode)) {
        const { data } = await db.from('marinas').select('id').eq('marina_code', marinaCode).maybeSingle()
        marinaCache.set(marinaCode, data ?? null)
      }
      const marina = marinaCache.get(marinaCode)
      if (!marina) {
        skipped += 1
        errors.push({ row: rowNo, message: `Marina not found for marina_code=${marinaCode}` })
        continue
      }

      const dock = await upsert(
        db,
        'docks',
        { marina_id: marina.id, name: dockName },
        {},
      )
      const slip = await upsert(
        db,
        'slips',
        { dock_id: dock.id, name: slipName },
        {
          marina_id: marina.id,
          slip_tier: optCell(row, 'Slip Tier'),
          slip_type: optCell(row, 'Slip Type'),
          slip_status: optCell(row, 'Slip Status'),
          is_active: true,
        },
      )

      // ---- Layer 2 ------------------------------------------------------
      const customerEmail = cell(row, 'Customer Email').toLowerCase()
      let userId: string | null = null
      if (customerEmail) {
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(customerEmail)) {
          warnings.push(`Row ${rowNo}: invalid customer email — skipping occupancy layer.`)
        } else {
          const hit = users.byEmail.get(customerEmail)
          if (!hit) warnings.push(`Row ${rowNo}: customer not found for ${customerEmail} — skipping occupancy layer.`)
          else userId = hit.userId
        }
      }

      const xnids = parseXnids(row)
      let inventoryDevices: { id: number }[] = []
      if (xnids.length > 0) {
        const { data } = await db.from('inventory_devices').select('id').in('xnid', xnids)
        inventoryDevices = data ?? []
        if (inventoryDevices.length === 0)
          warnings.push(`Row ${rowNo}: no inventory device found for xNID=${xnids.join(',')}`)
      }

      const boat = await upsert(
        db,
        'boats',
        { slip_id: slip.id },
        {
          marina_id: marina.id,
          dock_id: dock.id,
          boat_name: optCell(row, 'Boat Name') ?? 'Unknown Vessel',
          user_id: userId,
          street_address: optCell(row, 'Address'),
          country: optCell(row, 'Country'),
          state_province: optCell(row, 'State'),
          city: optCell(row, 'City'),
          postal_code: optCell(row, 'Postal Code'),
          boat_model: optCell(row, 'Boat Make/Model'),
          boat_type: optCell(row, 'Boat Type'),
          boat_length: optCell(row, 'Boat Length (ft/m)'),
          boat_loa: optCell(row, 'LOA (ft/m)'),
          beam: num(optCell(row, 'Beam (ft/m)')),
          draft: num(optCell(row, 'Draft (ft/m)')),
          power_requirement: optCell(row, 'Power Requirement'),
          monitoring_opt_in: optCell(row, 'Monitoring Opt-in'),
          monitoring_room: optCell(row, 'Room'),
          monitoring_area: optCell(row, 'Area'),
          monitoring_name: optCell(row, 'Max Device'),
          customer_type: optCell(row, 'Contract Type'),
          end_point: optCell(row, 'End Point'),
          interface: optCell(row, 'Interface'),
        },
      )

      // boat ↔ devices pivot (old stored a JSON array on the boat)
      for (const dev of inventoryDevices) {
        await db
          .from('boat_devices')
          .upsert({ boat_id: boat.id, inventory_device_id: dev.id }, { onConflict: 'boat_id,inventory_device_id' })
      }

      const reservation = await upsert(
        db,
        'reservations',
        { marina_id: marina.id, dock_id: dock.id, slip_id: slip.id, boat_id: boat.id, user_id: userId },
        {
          status: cell(row, 'Reservation').toLowerCase() === 'paid' ? 'confirmed' : 'pending',
          loa: intOrNull(optCell(row, 'LOA (ft/m)')),
          quote_id: null,
          billed_by: 'admin',
        },
        `xnid:event:reservation:${randomUUID()}`,
      )

      const assignment = await upsert(
        db,
        'assignments',
        { reservation_id: reservation.id, slip_id: slip.id, boat_id: boat.id },
        { marina_id: marina.id, status: 'assigned', start_date: today(), end_date: null },
        `xnid:assignment:${randomUUID()}`,
      )

      const { data: existingStay } = await db
        .from('stays')
        .select('id')
        .eq('assignment_id', assignment.id)
        .maybeSingle()
      if (!existingStay) {
        await db.from('stays').insert({
          xnid: `xnid:stay:${randomUUID()}`,
          marina_id: marina.id,
          assignment_id: assignment.id,
          reservation_id: reservation.id,
          boat_id: boat.id,
          status: 'pending',
        })
      }

      // ---- Layer 3 ----------------------------------------------------
      if (userId && inventoryDevices.length > 0) {
        for (const dev of inventoryDevices) {
          await provisionImportedDevice(db, {
            inventoryDeviceId: dev.id,
            userId,
            deviceName: optCell(row, 'Max Device'),
            deviceLocation: optCell(row, 'End Point'),
            notificationEmail: customerEmail || null,
          })
        }
      } else {
        warnings.push(
          `Row ${rowNo}: xUP preferences skipped — ${!userId ? 'no customer' : 'no inventory device'}.`,
        )
      }

      imported += 1
    } catch (e) {
      skipped += 1
      errors.push({ row: rowNo, message: (e as Error).message })
    }
  }

  const errorReportUrl = await writeErrorReport('marina', errors, warnings)
  return {
    ok: imported > 0,
    inserted: imported,
    updated: 0,
    skipped,
    warnings,
    errors,
    errorReportUrl,
    message: `Marina import completed. Imported: ${imported}, skipped: ${skipped}, warnings: ${warnings.length}.`,
  }
}

function parseXnids(row: ImportRow): string[] {
  const raw = cell(row, 'xNID').replace(/[^\x20-\x7E]/g, '')
  if (!raw || raw === '0') return []
  return [...new Set(raw.split(',').map((x) => x.trim().toUpperCase()).filter(Boolean))]
}

function num(v: string | null): number | null {
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
function intOrNull(v: string | null): number | null {
  if (v == null) return null
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? n : null
}
function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * updateOrCreate: match on `match`, merge `extra` (+ `xnidOnCreate` only when a
 * new row is inserted). Nulls in `extra` overwrite on update — matching
 * Laravel's `updateOrCreate` second-arg behaviour.
 */
async function upsert(
  db: ReturnType<typeof createServiceClient>,
  table: 'docks' | 'slips' | 'boats' | 'reservations' | 'assignments',
  match: Record<string, unknown>,
  extra: Record<string, unknown>,
  xnidOnCreate?: string,
): Promise<{ id: number }> {
  let query = db.from(table).select('id')
  for (const [k, v] of Object.entries(match)) {
    query = v == null ? query.is(k, null) : query.eq(k, v as never)
  }
  const { data: existing } = await query.maybeSingle()
  if (existing) {
    if (Object.keys(extra).length > 0) await db.from(table).update(extra as never).eq('id', existing.id)
    return existing
  }
  const insertRow = { ...match, ...extra, ...(xnidOnCreate ? { xnid: xnidOnCreate } : {}) }
  const { data: created, error } = await db.from(table).insert(insertRow as never).select('id').single()
  if (error || !created) throw new Error(`${table}: ${error?.message ?? 'insert failed'}`)
  return created
}

function fail(message: string): ImportOutcome {
  return { ok: false, inserted: 0, updated: 0, skipped: 0, warnings: [], errors: [], errorReportUrl: null, message }
}
