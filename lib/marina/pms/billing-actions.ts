'use server'

import { randomUUID } from 'node:crypto'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createClient } from '@/utils/supabase/server'
import { requirePermission } from '@/lib/auth/guards'
import type { PmsResult } from './actions'

/**
 * Marina PMS billing mutations — POS transactions, manual invoices, ledger
 * entries, meter readings. Ports the write side of `PosTransactionController` +
 * the missing `InvoiceController` verbs.
 *
 * Marina invoices are settled **manually** (`markInvoicePaid`) — the old system
 * has no payment flow for them (`InvoiceController` store/update/show are empty
 * stubs; the Stripe webhook's `handleInvoicePaid` is about device-subscription
 * billing, a different table). Recorded in ADR-033.
 */

const REVALIDATE = (marinaId: number) => revalidatePath(`/app/marina/${marinaId}/pms`)

// ===========================================================================
// POS transactions  (PosTransactionController)
// ===========================================================================
const posSchema = z.object({
  stay_id: z.coerce.number().int().positive(),
  marina_id: z.coerce.number().int().positive(),
  service_category: z.enum(['fuel', 'utility', 'service', 'adjustment', 'tax', 'misc']),
  service_name: z.string().trim().min(1).max(255),
  amount: z.coerce.number().nonnegative(),
  type: z.enum(['charge', 'credit']).optional().default('charge'),
  quantity: z.coerce.number().int().min(1).optional().default(1),
  unit_price: z.coerce.number().nonnegative().nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
})

export async function savePosTransaction(input: unknown): Promise<PmsResult<{ id: number }>> {
  const actor = await requirePermission('marina', 'create')
  const parsed = posSchema.safeParse(input)
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors }
  const v = parsed.data
  const supabase = await createClient()

  const { data: stay } = await supabase
    .from('stays')
    .select('id, status, reservation_id, assignment_id, boat_id, slip_id')
    .eq('id', v.stay_id)
    .maybeSingle()
  if (!stay) return { ok: false, error: 'Stay not found.' }
  if (!['checked_in', 'in_stay'].includes(stay.status))
    return { ok: false, error: 'Stay must be checked in to add POS transactions.' }

  const { data, error } = await supabase
    .from('pos_transactions')
    .insert({
      xnid: `xnid:pos:${randomUUID()}`,
      marina_id: v.marina_id,
      stay_id: stay.id,
      reservation_id: stay.reservation_id,
      assignment_id: stay.assignment_id,
      boat_id: stay.boat_id,
      slip_id: stay.slip_id,
      service_category: v.service_category,
      service_name: v.service_name,
      amount: v.amount,
      type: v.type,
      quantity: v.quantity,
      unit_price: v.unit_price ?? null,
      notes: v.notes ?? null,
      created_by: actor.id,
    })
    .select('id')
    .single()
  if (error || !data) return { ok: false, error: 'Could not record the transaction.' }
  REVALIDATE(v.marina_id)
  return { ok: true, data: { id: data.id } }
}

export async function updatePosTransaction(input: {
  id: number
  marinaId: number
  serviceName?: string
  amount?: number
  type?: 'charge' | 'credit'
  quantity?: number
  unitPrice?: number | null
  notes?: string | null
}): Promise<PmsResult> {
  await requirePermission('marina', 'update')
  const supabase = await createClient()
  const { data: txn } = await supabase
    .from('pos_transactions')
    .select('id, stay:stays(status)')
    .eq('id', input.id)
    .maybeSingle()
  if (!txn) return { ok: false, error: 'Transaction not found.' }
  if ((txn.stay as { status?: string } | null)?.status === 'checked_out')
    return { ok: false, error: 'Cannot modify transactions for a checked-out stay.' }

  const patch: {
    service_name?: string
    amount?: number
    type?: 'charge' | 'credit'
    quantity?: number
    unit_price?: number | null
    notes?: string | null
  } = {}
  if (input.serviceName !== undefined) patch.service_name = input.serviceName
  if (input.amount !== undefined) patch.amount = input.amount
  if (input.type !== undefined) patch.type = input.type
  if (input.quantity !== undefined) patch.quantity = input.quantity
  if (input.unitPrice !== undefined) patch.unit_price = input.unitPrice
  if (input.notes !== undefined) patch.notes = input.notes

  const { error } = await supabase.from('pos_transactions').update(patch).eq('id', input.id)
  if (error) return { ok: false, error: 'Could not update the transaction.' }
  REVALIDATE(input.marinaId)
  return { ok: true }
}

export async function deletePosTransaction(id: number, marinaId: number): Promise<PmsResult> {
  await requirePermission('marina', 'delete')
  const supabase = await createClient()
  const { data: txn } = await supabase
    .from('pos_transactions')
    .select('id, stay:stays(status)')
    .eq('id', id)
    .maybeSingle()
  if (!txn) return { ok: false, error: 'Transaction not found.' }
  if ((txn.stay as { status?: string } | null)?.status === 'checked_out')
    return { ok: false, error: 'Cannot delete transactions for a checked-out stay.' }
  const { error } = await supabase.from('pos_transactions').delete().eq('id', id)
  if (error) return { ok: false, error: 'Could not delete the transaction.' }
  REVALIDATE(marinaId)
  return { ok: true }
}

// ===========================================================================
// invoices + ledgers
// ===========================================================================
const invoiceSchema = z.object({
  marina_id: z.coerce.number().int().positive(),
  billable_type: z.enum(['contract', 'reservation', 'stay']),
  billable_id: z.coerce.number().int().positive(),
  amount: z.coerce.number().positive(),
})

/** Create a manual invoice (contract billing goes through `billContract`). */
export async function createInvoice(input: unknown): Promise<PmsResult<{ id: number }>> {
  await requirePermission('marina', 'create')
  const parsed = invoiceSchema.safeParse(input)
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors }
  const v = parsed.data
  const supabase = await createClient()

  const fk: { contract_id?: number; reservation_id?: number; stay_id?: number } = {}
  if (v.billable_type === 'contract') fk.contract_id = v.billable_id
  if (v.billable_type === 'reservation') fk.reservation_id = v.billable_id
  if (v.billable_type === 'stay') fk.stay_id = v.billable_id

  const { data, error } = await supabase
    .from('invoices')
    .insert({
      xnid: `xnid:invoice:${randomUUID()}`,
      marina_id: v.marina_id,
      billable_type: v.billable_type,
      billable_id: v.billable_id,
      amount: v.amount,
      status: 'unpaid',
      ...fk,
    })
    .select('id')
    .single()
  if (error || !data) return { ok: false, error: 'Could not create the invoice.' }
  REVALIDATE(v.marina_id)
  return { ok: true, data: { id: data.id } }
}

/** Manual settlement — writes `paid_at` + status + a balancing ledger credit. */
export async function markInvoicePaid(
  invoiceId: number,
  marinaId: number,
  opts: { partial?: number } = {},
): Promise<PmsResult> {
  await requirePermission('marina', 'update')
  const supabase = await createClient()
  const { data: inv } = await supabase
    .from('invoices')
    .select('id, marina_id, amount, status')
    .eq('id', invoiceId)
    .maybeSingle()
  if (!inv) return { ok: false, error: 'Invoice not found.' }
  if (inv.status === 'paid') return { ok: false, error: 'Invoice is already paid.' }
  if (inv.status === 'void') return { ok: false, error: 'Invoice is void.' }

  const credit = opts.partial != null && opts.partial > 0 ? opts.partial : Number(inv.amount ?? 0)
  const fullyPaid = credit >= Number(inv.amount ?? 0)

  const { error } = await supabase
    .from('invoices')
    .update({
      status: fullyPaid ? 'paid' : 'partially_paid',
      paid_at: fullyPaid ? new Date().toISOString() : null,
    })
    .eq('id', invoiceId)
  if (error) return { ok: false, error: 'Could not update the invoice.' }

  await supabase.from('ledgers').insert({
    xnid: `xnid:ledger:${randomUUID()}`,
    marina_id: inv.marina_id ?? marinaId,
    invoice_id: invoiceId,
    debit: 0,
    credit,
    memo: fullyPaid ? 'Payment received (manual)' : 'Partial payment (manual)',
  })

  REVALIDATE(marinaId)
  return { ok: true }
}

export async function voidInvoice(invoiceId: number, marinaId: number): Promise<PmsResult> {
  await requirePermission('marina', 'update')
  const supabase = await createClient()
  const { error } = await supabase.from('invoices').update({ status: 'void' }).eq('id', invoiceId)
  if (error) return { ok: false, error: 'Could not void the invoice.' }
  REVALIDATE(marinaId)
  return { ok: true }
}

export async function addLedgerEntry(input: {
  marinaId: number
  invoiceId?: number | null
  debit?: number
  credit?: number
  memo?: string | null
}): Promise<PmsResult> {
  await requirePermission('marina', 'create')
  const supabase = await createClient()
  const { error } = await supabase.from('ledgers').insert({
    xnid: `xnid:ledger:${randomUUID()}`,
    marina_id: input.marinaId,
    invoice_id: input.invoiceId ?? null,
    debit: input.debit ?? 0,
    credit: input.credit ?? 0,
    memo: input.memo ?? null,
  })
  if (error) return { ok: false, error: 'Could not add the ledger entry.' }
  REVALIDATE(input.marinaId)
  return { ok: true }
}

// ===========================================================================
// meters
// ===========================================================================
export async function addMeterReading(input: {
  marinaId: number
  slipId: number
  reading: number
}): Promise<PmsResult> {
  await requirePermission('marina', 'create')
  if (!(input.reading >= 0)) return { ok: false, error: 'A non-negative reading is required.' }
  const supabase = await createClient()
  const { error } = await supabase.from('meters').insert({
    xnid: `xnid:meter:${randomUUID()}`,
    marina_id: input.marinaId,
    slip_id: input.slipId,
    reading: input.reading,
  })
  if (error) return { ok: false, error: 'Could not record the reading.' }
  REVALIDATE(input.marinaId)
  return { ok: true }
}

export async function deleteMeterReading(id: number, marinaId: number): Promise<PmsResult> {
  await requirePermission('marina', 'delete')
  const supabase = await createClient()
  const { error } = await supabase.from('meters').delete().eq('id', id)
  if (error) return { ok: false, error: 'Could not delete the reading.' }
  REVALIDATE(marinaId)
  return { ok: true }
}
