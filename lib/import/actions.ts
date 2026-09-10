'use server'

import { revalidatePath } from 'next/cache'

import { requirePermission } from '@/lib/auth/guards'

import { importInventory } from './inventory'
import { importBuilding } from './building'
import { importMarina } from './marina'
import { importCustomers } from './customers'
import type { ImportOutcome } from './parse'

/**
 * Server Actions for the 4 CSV importers (`ImportController`). Each: check the
 * module `create` permission, pull the file out of the FormData, run the
 * importer (service client — a bulk system write), return the outcome. The
 * matching `app/api/import/[entity]` Route Handler wraps the same functions for
 * 1:1 API parity.
 */

function fileFrom(form: FormData): File | null {
  for (const [, value] of form.entries()) {
    if (value instanceof File && value.size > 0) return value
  }
  return null
}

const NO_FILE: ImportOutcome = {
  ok: false,
  inserted: 0,
  updated: 0,
  skipped: 0,
  warnings: [],
  errors: [],
  errorReportUrl: null,
  message: 'No valid CSV file was uploaded.',
}

export async function runInventoryImport(form: FormData): Promise<ImportOutcome> {
  await requirePermission('inventory', 'create')
  const file = fileFrom(form)
  if (!file) return NO_FILE
  const result = await importInventory(file)
  revalidatePath('/app/inventory')
  return result
}

export async function runBuildingImport(form: FormData): Promise<ImportOutcome> {
  await requirePermission('buildings', 'create')
  const file = fileFrom(form)
  if (!file) return NO_FILE
  const result = await importBuilding(file)
  revalidatePath('/app/buildings')
  return result
}

export async function runMarinaImport(form: FormData): Promise<ImportOutcome> {
  await requirePermission('marina', 'create')
  const file = fileFrom(form)
  if (!file) return NO_FILE
  const result = await importMarina(file)
  revalidatePath('/app/marina')
  return result
}

export async function runCustomersImport(form: FormData): Promise<ImportOutcome> {
  await requirePermission('systems', 'create')
  const file = fileFrom(form)
  if (!file) return NO_FILE
  const result = await importCustomers(file)
  revalidatePath('/app/customers')
  return result
}
