import 'server-only'

import { randomBytes } from 'node:crypto'

import { createServiceClient } from '@/utils/supabase/service'

import { buildUserLookup } from './lookup'
import {
  cell,
  missingColumn,
  parseCsv,
  writeErrorReport,
  type ImportOutcome,
  type RowError,
} from './parse'

/**
 * `ImportController@importInventory`. Creates one `containers` row for the file,
 * then upserts an `inventory_devices` row per data row (matched on dev EUI or
 * xNID). LoRaWAN secrets go to `inventory_device_secrets` (A10 / ADR-025 — the
 * old code wrote them onto `inventory_devices`).
 */

const REQUIRED = [
  'SENSOR NAME',
  'DEVICE TYPE',
  'XNID',
  'T-CODE',
  'SERIAL NUMBER',
  'DEVEUI',
  'APPEUI',
  'APPKEY',
  'DEVADDR',
  'NWKSKEY',
  'APPSKEY',
  'PART NUMBER',
  'PRODUCT NAME',
]

export async function importInventory(file: File | Blob): Promise<ImportOutcome> {
  const parsed = await parseCsv(file, { normaliseHeader: (h) => h.toUpperCase() })
  if (!parsed.ok) return fail(parsed.error ?? 'Could not read the CSV.')

  const missing = missingColumn(parsed.header, REQUIRED)
  if (missing) return fail(`Missing required column: ${missing}`)
  if (parsed.rows.length === 0) return fail('CSV file contains no data rows.')

  const db = createServiceClient()
  const errors: RowError[] = []
  const warnings: string[] = []
  let inserted = 0
  let updated = 0
  let skipped = 0

  // container for this file
  const containerCode = cell(parsed.rows[0], 'CONTAINER_ID') || randomBytes(10).toString('hex').slice(0, 14)
  const { data: container, error: cErr } = await db
    .from('containers')
    .insert({ code: containerCode })
    .select('id')
    .single()
  if (cErr || !container) return fail('Failed to create the container for this import.')

  const users = await buildUserLookup(db)
  const deviceTypeCache = new Map<string, number>()

  for (let i = 0; i < parsed.rows.length; i += 1) {
    const rowNo = i + 1
    const row = parsed.rows[i]
    try {
      const productName = cell(row, 'PRODUCT NAME')
      const { data: product } = await db
        .from('products')
        .select('id')
        .ilike('product_name', productName)
        .maybeSingle()
      if (!product) {
        skipped += 1
        errors.push({ row: rowNo, message: `Product not found [${productName}]` })
        continue
      }

      const sensorName = cell(row, 'SENSOR NAME')
      if (!sensorName) {
        skipped += 1
        errors.push({ row: rowNo, message: 'SENSOR NAME is empty.' })
        continue
      }

      const devEui = cell(row, 'DEVEUI').toUpperCase()
      if (!devEui) {
        skipped += 1
        errors.push({ row: rowNo, message: 'DEVEUI is empty.' })
        continue
      }

      // device type — firstOrCreate by name
      let deviceTypeId: number | null = null
      const deviceTypeName = cell(row, 'DEVICE TYPE')
      if (deviceTypeName) {
        deviceTypeId = deviceTypeCache.get(deviceTypeName) ?? null
        if (deviceTypeId == null) {
          const { data: existing } = await db
            .from('device_types')
            .select('id')
            .eq('name', deviceTypeName)
            .maybeSingle()
          if (existing) deviceTypeId = existing.id
          else {
            const { data: created } = await db
              .from('device_types')
              .insert({ name: deviceTypeName, description: deviceTypeName })
              .select('id')
              .single()
            deviceTypeId = created?.id ?? null
          }
          if (deviceTypeId != null) deviceTypeCache.set(deviceTypeName, deviceTypeId)
        }
      }

      // company via ADMINEMAIL (optional)
      let companyId: number | null = null
      const adminEmail = cell(row, 'ADMINEMAIL').toLowerCase()
      if (adminEmail) {
        const hit = users.byEmail.get(adminEmail)
        if (!hit) {
          skipped += 1
          errors.push({ row: rowNo, message: `ADMINEMAIL not found [${adminEmail}]` })
          continue
        }
        if (hit.companyId == null) {
          skipped += 1
          errors.push({ row: rowNo, message: `No company assigned to user [${adminEmail}]` })
          continue
        }
        companyId = hit.companyId
      }

      const xnid = cell(row, 'XNID') || null
      const deviceRow = {
        name: sensorName,
        device_type_id: deviceTypeId,
        activation_code: xnid,
        xnid,
        t_code: cell(row, 'T-CODE') || null,
        serial_number: cell(row, 'SERIAL NUMBER') || null,
        dev_eui: devEui,
        part_number: cell(row, 'PART NUMBER') || null,
        container_id: container.id,
        product_id: product.id,
        company_id: companyId,
      }

      // match on dev EUI or xNID
      const orFilter = xnid ? `dev_eui.eq.${devEui},xnid.eq.${xnid}` : `dev_eui.eq.${devEui}`
      const { data: existing } = await db
        .from('inventory_devices')
        .select('id')
        .or(orFilter)
        .maybeSingle()

      let deviceId: number
      if (existing) {
        await db.from('inventory_devices').update(deviceRow).eq('id', existing.id)
        deviceId = existing.id
        updated += 1
      } else {
        const { data: created, error: iErr } = await db
          .from('inventory_devices')
          .insert(deviceRow)
          .select('id')
          .single()
        if (iErr || !created) {
          skipped += 1
          errors.push({ row: rowNo, message: iErr?.message ?? 'Insert failed.' })
          continue
        }
        deviceId = created.id
        inserted += 1
      }

      // LoRaWAN secrets → separate table (ADR-025)
      const secretRow = {
        inventory_device_id: deviceId,
        app_key: cell(row, 'APPKEY') || null,
        app_eui: cell(row, 'APPEUI') || null,
        dev_addr: cell(row, 'DEVADDR') || null,
        nwkskey: cell(row, 'NWKSKEY') || null,
        appskey: cell(row, 'APPSKEY') || null,
      }
      if (secretRow.app_key || secretRow.app_eui || secretRow.dev_addr || secretRow.nwkskey || secretRow.appskey) {
        await db
          .from('inventory_device_secrets')
          .upsert(secretRow, { onConflict: 'inventory_device_id' })
      }
    } catch (e) {
      skipped += 1
      errors.push({ row: rowNo, message: (e as Error).message })
    }
  }

  const errorReportUrl = await writeErrorReport('inventory', errors, warnings)
  return {
    ok: inserted + updated > 0,
    inserted,
    updated,
    skipped,
    warnings,
    errors,
    errorReportUrl,
    message: `Inventory import completed. Imported/updated: ${inserted + updated}, skipped: ${skipped}.`,
  }
}

function fail(message: string): ImportOutcome {
  return {
    ok: false,
    inserted: 0,
    updated: 0,
    skipped: 0,
    warnings: [],
    errors: [],
    errorReportUrl: null,
    message,
  }
}
