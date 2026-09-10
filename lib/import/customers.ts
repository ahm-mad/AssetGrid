import 'server-only'

import { createServiceClient } from '@/utils/supabase/service'

import { buildUserLookup } from './lookup'
import { cell, missingColumn, parseCsv, writeErrorReport, type ImportOutcome, type RowError } from './parse'

/**
 * `ImportController@importCustomers`. Creates or updates a Customer-role
 * `profiles` row (+ its `auth.users` account via `admin.createUser` when new —
 * ADR-020's hash import is ETL-only; imported customers get a random password
 * they reset) and a `profile_details` row. Commercial customers
 * (`Residential = 0`) have their `user_devices` cleared, matching the old
 * "commercial cleanup".
 */

const REQUIRED = ['First Name', 'Last Name', 'Email']

export async function importCustomers(file: File | Blob): Promise<ImportOutcome> {
  const parsed = await parseCsv(file)
  if (!parsed.ok) return fail(parsed.error ?? 'Could not read the CSV.')
  const missing = missingColumn(parsed.header, REQUIRED)
  if (missing) return fail(`Missing required column: ${missing}`)
  if (parsed.rows.length === 0) return fail('CSV file contains no data rows.')

  const db = createServiceClient()
  const { data: role } = await db.from('role_types').select('id').ilike('title', 'Customer').maybeSingle()
  const customerRoleId = role?.id ?? 3

  const users = await buildUserLookup(db)
  const errors: RowError[] = []
  let inserted = 0
  let updated = 0
  let skipped = 0

  for (let i = 0; i < parsed.rows.length; i += 1) {
    const rowNo = i + 1
    const row = parsed.rows[i]
    try {
      const email = cell(row, 'Email').toLowerCase()
      if (!email) {
        skipped += 1
        errors.push({ row: rowNo, message: 'Email is empty.' })
        continue
      }

      const residentialRaw = cell(row, 'Residential')
      if (residentialRaw !== '0' && residentialRaw !== '1') {
        skipped += 1
        errors.push({ row: rowNo, message: 'Residential must be 0 or 1.' })
        continue
      }
      const isResidential = residentialRaw === '1'
      const xnidRaw = cell(row, 'Xnid')
      if (isResidential && !xnidRaw) {
        skipped += 1
        errors.push({ row: rowNo, message: 'Residential customer requires Xnid.' })
        continue
      }
      const xnid = isResidential ? xnidRaw : null

      const firstName = cell(row, 'First Name')
      const lastName = cell(row, 'Last Name')

      let userId = users.byEmail.get(email)?.userId ?? null

      if (userId) {
        await db
          .from('profiles')
          .update({
            first_name: firstName,
            last_name: lastName,
            role_type_id: customerRoleId,
            residence_customer: isResidential,
            xnid,
          })
          .eq('id', userId)
        updated += 1
      } else {
        const { data: created, error: cErr } = await db.auth.admin.createUser({
          email,
          email_confirm: false,
          user_metadata: { first_name: firstName, last_name: lastName, role_type_id: customerRoleId },
        })
        if (cErr || !created.user) {
          skipped += 1
          errors.push({ row: rowNo, message: cErr?.message ?? 'Could not create the auth user.' })
          continue
        }
        userId = created.user.id
        users.byEmail.set(email, { userId, companyId: null })
        // the handle_new_user trigger created the profile; finish the extra fields
        await db
          .from('profiles')
          .update({ residence_customer: isResidential, xnid, role_type_id: customerRoleId })
          .eq('id', userId)
        inserted += 1
      }

      const notifPhone = cell(row, 'Notification Phone Number')
      const notifEmail = cell(row, 'Notification Email')
      await db.from('profile_details').upsert(
        {
          user_id: userId,
          phone_number: cell(row, 'Phone Number') || null,
          notification_phone: notifPhone ? [notifPhone] : null,
          notification_email: notifEmail ? [notifEmail] : null,
          address_1: cell(row, 'Address 1') || null,
          address_2: cell(row, 'Address 2') || null,
          city: cell(row, 'City') || null,
          state: cell(row, 'State') || null,
          country: cell(row, 'Country') || null,
          postal_code: cell(row, 'Zip Code') || null,
        },
        { onConflict: 'user_id' },
      )

      if (!isResidential) {
        await db.from('user_devices').delete().eq('user_id', userId)
      }
    } catch (e) {
      skipped += 1
      errors.push({ row: rowNo, message: (e as Error).message })
    }
  }

  const errorReportUrl = await writeErrorReport('customers', errors)
  return {
    ok: inserted + updated > 0,
    inserted,
    updated,
    skipped,
    warnings: [],
    errors,
    errorReportUrl,
    message: `Customer import completed. Created: ${inserted}, updated: ${updated}, skipped: ${skipped}.`,
  }
}

function fail(message: string): ImportOutcome {
  return { ok: false, inserted: 0, updated: 0, skipped: 0, warnings: [], errors: [], errorReportUrl: null, message }
}
