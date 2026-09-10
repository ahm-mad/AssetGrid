import 'server-only'

import Papa from 'papaparse'

import { createServiceClient } from '@/utils/supabase/service'

/**
 * Shared CSV plumbing for the 4 bulk importers (`ImportController`). Each
 * importer: parse the upload → check required columns → validate + insert each
 * row (collecting per-row errors, skipping bad rows — matches the old
 * `fgetcsv` loop with `continue`) → on any errors, write an error-report CSV to
 * the private `imports` Storage bucket and return a signed URL.
 */

export interface ImportRow {
  [column: string]: string
}

export interface ParsedCsv {
  ok: boolean
  error?: string
  header: string[]
  rows: ImportRow[]
}

/** Parse a CSV File/Blob. Delimiter is auto-detected (`,` or `;`). */
export async function parseCsv(
  file: File | Blob,
  opts: { normaliseHeader?: (h: string) => string } = {},
): Promise<ParsedCsv> {
  const text = await file.text()
  const stripped = text.replace(/^﻿/, '') // BOM

  const result = Papa.parse<ImportRow>(stripped, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => {
      const trimmed = h.replace(/^﻿/, '').trim()
      return opts.normaliseHeader ? opts.normaliseHeader(trimmed) : trimmed
    },
  })

  if (result.errors.length > 0) {
    // Papa reports row-level issues too; only a top-level parse failure is fatal.
    const fatal = result.errors.find((e) => e.row == null)
    if (fatal) return { ok: false, error: `CSV parse error: ${fatal.message}`, header: [], rows: [] }
  }

  const header = result.meta.fields ?? []
  const rows = (result.data ?? []).filter((r) => Object.values(r).some((v) => String(v ?? '').trim() !== ''))
  return { ok: true, header, rows }
}

/** Returns the first missing required column, or null. */
export function missingColumn(header: string[], required: string[]): string | null {
  const have = new Set(header.map((h) => h.trim()))
  for (const col of required) if (!have.has(col)) return col
  return null
}

export interface RowError {
  row: number // 1-based data-row number (header is row 0)
  message: string
}

export interface ImportOutcome {
  ok: boolean
  inserted: number
  updated: number
  skipped: number
  warnings: string[]
  errors: RowError[]
  errorReportUrl: string | null
  message: string
}

/**
 * Build the error-report CSV (`row,type,message`) from the collected errors +
 * warnings, upload it to the private `imports` bucket, and return a 7-day
 * signed URL. Returns null when there is nothing to report.
 */
export async function writeErrorReport(
  entity: string,
  errors: RowError[],
  warnings: string[] = [],
): Promise<string | null> {
  if (errors.length === 0 && warnings.length === 0) return null

  const lines: string[][] = [['row', 'type', 'message']]
  for (const e of errors) lines.push([String(e.row), 'error', e.message])
  for (const w of warnings) lines.push(['', 'warning', w])
  const csv = Papa.unparse(lines)

  const db = createServiceClient()
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const path = `${entity}/${stamp}.csv`
  const up = await db.storage.from('imports').upload(path, csv, {
    contentType: 'text/csv',
    upsert: true,
  })
  if (up.error) return null
  const signed = await db.storage.from('imports').createSignedUrl(path, 60 * 60 * 24 * 7)
  return signed.data?.signedUrl ?? null
}

/** Trim every value in a row and treat '' / '0' as absent for optional fields. */
export function cell(row: ImportRow, key: string): string {
  return String(row[key] ?? '').trim()
}
export function optCell(row: ImportRow, key: string): string | null {
  const v = cell(row, key)
  return v === '' || v === '0' ? null : v
}
