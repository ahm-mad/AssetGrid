'use server'

import { createHash, randomBytes, randomUUID } from 'node:crypto'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { z } from 'zod'

import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { requirePermission } from '@/lib/auth/guards'
import { sendMail, isMailConfigured } from '@/lib/mail/resend'
import { phpRound } from '@/lib/marina/pricing'
import { renderContractPdf, type ContractPdfData } from './contract-pdf'
import type { PmsResult } from './actions'

/**
 * Marina PMS — contract lifecycle. Ports `ContractController`:
 * `generateContract` / `store` / `preview` / `sign` / `send` / `amend` /
 * `signAmendment` (+ `applyAmendment`) / `bill` / `terminate` / `update`, plus
 * the public e-sign that replaces the Laravel `signed` route
 * (`app/contracts/sign/[token]`).
 *
 * PDFs render server-side (`contract-pdf.tsx`) and upload to the private
 * `contracts` Storage bucket via the service client; `pdf_url` is a signed URL.
 */

const SIGN_TOKEN_TTL_HOURS = 24
const SIGN_SECRET =
  process.env.CONTRACT_SIGN_SECRET ?? process.env.INTERNAL_FUNCTION_SECRET ?? 'dev-contract-sign-secret'

// ContractController::contractTransitions()
const CONTRACT_TRANSITIONS: Record<string, string[]> = {
  not_required: ['required', 'sent', 'signed', 'active'],
  required: ['sent', 'not_required'],
  sent: ['signed', 'rejected', 'required'],
  signed: ['active', 'terminated'],
  active: ['expired', 'terminated', 'amendment_required'],
  expired: [],
  terminated: [],
  amendment_required: ['amended', 'terminated'],
  amended: ['active', 'terminated'],
}

function standardTerms(slipName: string | null): Record<string, string> {
  return {
    liability_clause: 'Marina not responsible for damages.',
    refund_policy: 'No refund after check-in.',
    electrical_requirements: 'Max 30A allowed.',
    slip_assignment: slipName ?? '',
    arrival_procedures: 'Contact marina before arrival.',
  }
}

function signatureHash(terms: unknown, userId: string | null): string {
  return createHash('sha256')
    .update(JSON.stringify(terms ?? {}) + (userId ?? '') + SIGN_SECRET)
    .digest('hex')
}

const CONTRACT_PDF_SELECT =
  'id, xnid, status, monthly_rate, start_date, end_date, signed_at, structured_terms, marina_id, slip:slips(name), boat:boats(boat_name), customer:profiles(first_name, last_name), marina:marinas(marina_name, marina_code)'

async function buildPdfData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  contractId: number,
  signUrl?: string | null,
): Promise<ContractPdfData | null> {
  const { data } = await supabase.from('contracts').select(CONTRACT_PDF_SELECT).eq('id', contractId).maybeSingle()
  if (!data) return null
  const r = data as Record<string, unknown>
  const cust = r.customer as { first_name?: string | null; last_name?: string | null } | null
  const marina = r.marina as { marina_name?: string | null; marina_code?: string | null } | null
  return {
    contractId: r.id as number,
    xnid: (r.xnid as string | null) ?? null,
    marinaName: marina?.marina_name || marina?.marina_code || 'Marina',
    boatName: (r.boat as { boat_name?: string | null } | null)?.boat_name ?? '—',
    slipName: (r.slip as { name?: string | null } | null)?.name ?? null,
    customerName: cust ? [cust.first_name, cust.last_name].filter(Boolean).join(' ') || null : null,
    startDate: (r.start_date as string | null) ?? null,
    endDate: (r.end_date as string | null) ?? null,
    monthlyRate: Number(r.monthly_rate ?? 0),
    status: (r.status as string) ?? 'required',
    structuredTerms: (r.structured_terms as Record<string, string | null> | null) ?? null,
    signUrl: signUrl ?? null,
    signedAt: (r.signed_at as string | null) ?? null,
  }
}

/** Render + upload the contract PDF; returns the storage path + a signed URL. */
async function renderAndStore(
  supabase: Awaited<ReturnType<typeof createClient>>,
  contractId: number,
  signUrl?: string | null,
): Promise<{ path: string; url: string } | null> {
  const pdfData = await buildPdfData(supabase, contractId, signUrl)
  if (!pdfData) return null
  const buffer = await renderContractPdf(pdfData)
  const db = createServiceClient()
  const path = `contracts/${contractId}.pdf`
  const up = await db.storage.from('contracts').upload(path, buffer, {
    contentType: 'application/pdf',
    upsert: true,
  })
  if (up.error) return null
  const signed = await db.storage.from('contracts').createSignedUrl(path, 60 * 60 * 24 * 7)
  return { path, url: signed.data?.signedUrl ?? path }
}

// ===========================================================================
// generate / create
// ===========================================================================
/** `ContractController@generateContract($reservationId)` + `generateContractInternal`. */
export async function generateContract(reservationId: number): Promise<PmsResult<{ id: number }>> {
  await requirePermission('marina', 'create')
  const supabase = await createClient()

  const { data: res } = await supabase
    .from('reservations')
    .select(
      'id, marina_id, boat_id, slip_id, rate_plan_id, user_id, start_date, end_date, rate, days, assignments(slip_id, slip:slips(name))',
    )
    .eq('id', reservationId)
    .maybeSingle()
  if (!res) return { ok: false, error: 'Reservation not found.' }

  const assignment = ((res.assignments as { slip_id: number | null; slip: { name: string | null } | null }[] | null) ??
    [])[0]
  const slipId = assignment?.slip_id ?? res.slip_id
  if (!slipId) return { ok: false, error: 'Assign a slip before generating a contract.' }
  if (!res.boat_id || !res.rate_plan_id) return { ok: false, error: 'Reservation is missing a boat or rate plan.' }

  const monthlyRate = phpRound(Number(res.rate ?? 0) * 30, 2)
  const { data, error } = await supabase
    .from('contracts')
    .insert({
      xnid: `xnid:contract:${randomUUID()}`,
      marina_id: res.marina_id,
      reservation_id: res.id,
      boat_id: res.boat_id,
      slip_id: slipId,
      rate_plan_id: res.rate_plan_id,
      user_id: res.user_id,
      monthly_rate: monthlyRate,
      start_date: res.start_date,
      end_date: res.end_date,
      structured_terms: standardTerms(assignment?.slip?.name ?? null),
      status: 'required',
    })
    .select('id')
    .single()
  if (error || !data) return { ok: false, error: 'Could not generate the contract.' }

  await renderStoreAndSave(supabase, data.id)

  revalidatePath(`/app/marina/${res.marina_id}/pms/reservations/${reservationId}`)
  return { ok: true, data: { id: data.id } }
}

const manualContractSchema = z.object({
  marina_id: z.coerce.number().int().positive(),
  slip_id: z.coerce.number().int().positive(),
  boat_id: z.coerce.number().int().positive(),
  rate_plan_id: z.coerce.number().int().positive(),
  reservation_id: z.coerce.number().int().positive().nullable().optional(),
  user_id: z.string().uuid().nullable().optional(),
  start_date: z.string().trim().min(1),
  end_date: z.string().trim().min(1),
  monthly_rate: z.coerce.number().nonnegative().optional().default(0),
  contract_type: z.string().trim().max(30).nullable().optional(),
})

/** `ContractController@store` — manual contract create. */
export async function saveContract(input: unknown): Promise<PmsResult<{ id: number }>> {
  await requirePermission('marina', 'create')
  const parsed = manualContractSchema.safeParse(input)
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors }
  const v = parsed.data
  if (v.end_date.slice(0, 10) <= v.start_date.slice(0, 10))
    return { ok: false, error: 'End date must be after the start date.' }

  const supabase = await createClient()
  const { data: slip } = await supabase.from('slips').select('name').eq('id', v.slip_id).maybeSingle()
  const { data, error } = await supabase
    .from('contracts')
    .insert({
      xnid: `xnid:contract:${randomUUID()}`,
      marina_id: v.marina_id,
      slip_id: v.slip_id,
      boat_id: v.boat_id,
      rate_plan_id: v.rate_plan_id,
      reservation_id: v.reservation_id ?? null,
      user_id: v.user_id ?? null,
      contract_type: v.contract_type ?? null,
      monthly_rate: v.monthly_rate,
      start_date: v.start_date.slice(0, 10),
      end_date: v.end_date.slice(0, 10),
      structured_terms: standardTerms(slip?.name ?? null),
      status: 'required',
    })
    .select('id')
    .single()
  if (error || !data) return { ok: false, error: 'Could not create the contract.' }
  revalidatePath(`/app/marina/${v.marina_id}/pms`)
  return { ok: true, data: { id: data.id } }
}

// ===========================================================================
// send (PDF + email + e-sign token)
// ===========================================================================
export async function sendContract(contractId: number): Promise<PmsResult<{ signUrl: string; emailed: boolean }>> {
  await requirePermission('marina', 'update')
  const supabase = await createClient()

  const { data: contract } = await supabase
    .from('contracts')
    .select('id, marina_id, status, reservation_id, user_id, signature, customer:profiles(email, first_name, last_name)')
    .eq('id', contractId)
    .maybeSingle()
  if (!contract) return { ok: false, error: 'Contract not found.' }
  if (contract.signature) return { ok: false, error: 'Contract is already signed.' }

  const db = createServiceClient()
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + SIGN_TOKEN_TTL_HOURS * 3600 * 1000).toISOString()
  const { error: tokErr } = await db.from('contract_sign_tokens').insert({
    token,
    contract_id: contractId,
    expires_at: expiresAt,
  })
  if (tokErr) return { ok: false, error: 'Could not create the signing link.' }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const signUrl = `${baseUrl}/contracts/sign/${token}`

  const stored = await renderAndStore(supabase, contractId, signUrl)
  const cust = contract.customer as { email?: string | null; first_name?: string | null; last_name?: string | null } | null

  let emailed = false
  if (cust?.email && isMailConfigured()) {
    const db2 = createServiceClient()
    let attachment: { filename: string; content: string } | undefined
    if (stored) {
      const dl = await db2.storage.from('contracts').download(stored.path)
      if (dl.data) {
        const buf = Buffer.from(await dl.data.arrayBuffer())
        attachment = { filename: `contract-${contractId}.pdf`, content: buf.toString('base64') }
      }
    }
    const sent = await sendMail({
      to: cust.email,
      subject: `Your marina slip contract #${contractId}`,
      text: `Hello ${[cust.first_name, cust.last_name].filter(Boolean).join(' ') || 'there'},\n\nPlease review and sign your marina slip contract:\n${signUrl}\n\nThis link expires in ${SIGN_TOKEN_TTL_HOURS} hours.`,
      attachments: attachment ? [attachment] : undefined,
    })
    emailed = sent.ok
  }

  const patch: { status: string; pdf_path?: string; pdf_url?: string } = { status: 'sent' }
  if (stored) {
    patch.pdf_path = stored.path
    patch.pdf_url = stored.url
  }
  await supabase.from('contracts').update(patch).eq('id', contractId)

  revalidatePath(`/app/marina/${contract.marina_id}/pms`)
  if (contract.reservation_id)
    revalidatePath(`/app/marina/${contract.marina_id}/pms/reservations/${contract.reservation_id}`)
  return { ok: true, data: { signUrl, emailed } }
}

// ===========================================================================
// sign (internal admin) + status
// ===========================================================================
/** `ContractController@sign($reservationId)` — admin-side signature. */
export async function signContract(contractId: number): Promise<PmsResult> {
  await requirePermission('marina', 'update')
  const supabase = await createClient()

  const { data: contract } = await supabase
    .from('contracts')
    .select('id, marina_id, status, reservation_id, user_id, signature, structured_terms')
    .eq('id', contractId)
    .maybeSingle()
  if (!contract) return { ok: false, error: 'Contract not found.' }
  if (contract.signature) return { ok: false, error: 'Contract already signed and immutable.' }

  const signature = {
    user_id: contract.user_id,
    timestamp: new Date().toISOString(),
    signature_hash: signatureHash(contract.structured_terms, contract.user_id),
    source: 'admin',
  }
  await supabase
    .from('contracts')
    .update({ signature, status: 'signed', signed_at: new Date().toISOString() })
    .eq('id', contractId)
  await cascadeAfterSign(supabase, contract.reservation_id)
  await renderStoreAndSave(supabase, contractId)

  revalidatePath(`/app/marina/${contract.marina_id}/pms`)
  if (contract.reservation_id)
    revalidatePath(`/app/marina/${contract.marina_id}/pms/reservations/${contract.reservation_id}`)
  return { ok: true }
}

async function cascadeAfterSign(
  supabase: Awaited<ReturnType<typeof createClient>>,
  reservationId: number | null,
): Promise<void> {
  if (!reservationId) return
  await supabase.from('reservations').update({ status: 'contract_signed' }).eq('id', reservationId)
  await supabase.from('assignments').update({ status: 'assigned' }).eq('reservation_id', reservationId)
  await supabase.from('stays').update({ status: 'expected' }).eq('reservation_id', reservationId)
}

async function renderStoreAndSave(
  supabase: Awaited<ReturnType<typeof createClient>>,
  contractId: number,
): Promise<void> {
  const stored = await renderAndStore(supabase, contractId)
  if (stored) await supabase.from('contracts').update({ pdf_path: stored.path, pdf_url: stored.url }).eq('id', contractId)
}

export async function updateContractStatus(
  contractId: number,
  status: string,
  marinaId: number,
): Promise<PmsResult> {
  await requirePermission('marina', 'update')
  const supabase = await createClient()
  const { data: contract } = await supabase
    .from('contracts')
    .select('status, signature')
    .eq('id', contractId)
    .maybeSingle()
  if (!contract) return { ok: false, error: 'Contract not found.' }
  if (contract.signature && status !== 'terminated' && status !== 'expired')
    return { ok: false, error: 'Signed contracts cannot be modified.' }
  if (!(CONTRACT_TRANSITIONS[contract.status] ?? []).includes(status))
    return { ok: false, error: 'Invalid status transition.' }
  await supabase.from('contracts').update({ status }).eq('id', contractId)
  revalidatePath(`/app/marina/${marinaId}/pms`)
  return { ok: true }
}

/** `ContractController@terminate`. */
export async function terminateContract(input: {
  contractId: number
  marinaId: number
  reason: string
  terminationDate: string
}): Promise<PmsResult> {
  await requirePermission('marina', 'update')
  if (!input.reason?.trim()) return { ok: false, error: 'A termination reason is required.' }
  const supabase = await createClient()
  const { data: contract } = await supabase
    .from('contracts')
    .select('id, reservation_id')
    .eq('id', input.contractId)
    .maybeSingle()
  if (!contract) return { ok: false, error: 'Contract not found.' }

  await supabase
    .from('contracts')
    .update({ status: 'terminated', end_date: input.terminationDate.slice(0, 10) })
    .eq('id', input.contractId)
  if (contract.reservation_id) {
    await supabase.from('assignments').update({ status: 'released' }).eq('reservation_id', contract.reservation_id)
    await supabase.from('stays').update({ status: 'checked_out' }).eq('reservation_id', contract.reservation_id)
  }
  revalidatePath(`/app/marina/${input.marinaId}/pms`)
  return { ok: true }
}

/** `ContractController@bill` — signed|active contract → an unpaid invoice. */
export async function billContract(contractId: number, marinaId: number): Promise<PmsResult<{ invoiceId: number }>> {
  await requirePermission('marina', 'create')
  const supabase = await createClient()
  const { data: contract } = await supabase
    .from('contracts')
    .select('id, marina_id, status, monthly_rate')
    .eq('id', contractId)
    .maybeSingle()
  if (!contract) return { ok: false, error: 'Contract not found.' }
  if (!['signed', 'active'].includes(contract.status))
    return { ok: false, error: 'Contract must be signed or active to bill.' }

  const { data, error } = await supabase
    .from('invoices')
    .insert({
      xnid: `xnid:invoice:${randomUUID()}`,
      marina_id: contract.marina_id,
      billable_type: 'contract',
      billable_id: contractId,
      contract_id: contractId,
      amount: Number(contract.monthly_rate ?? 0),
      status: 'unpaid',
    })
    .select('id')
    .single()
  if (error || !data) return { ok: false, error: 'Could not create the invoice.' }
  revalidatePath(`/app/marina/${marinaId}/pms`)
  return { ok: true, data: { invoiceId: data.id } }
}

// ===========================================================================
// amendments
// ===========================================================================
const amendmentSchema = z.object({
  contract_id: z.coerce.number().int().positive(),
  marina_id: z.coerce.number().int().positive(),
  amendment_type: z.enum(['rate_change', 'date_extension', 'slip_change', 'terms_change']),
  description: z.string().trim().max(2000).nullable().optional(),
  new_amount: z.coerce.number().nonnegative().nullable().optional(),
  new_start_date: z.string().trim().min(1).nullable().optional(),
  new_end_date: z.string().trim().min(1).nullable().optional(),
  new_slip_id: z.coerce.number().int().positive().nullable().optional(),
})

/** `ContractController@amend`. */
export async function amendContract(input: unknown): Promise<PmsResult<{ id: number }>> {
  await requirePermission('marina', 'update')
  const parsed = amendmentSchema.safeParse(input)
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors }
  const v = parsed.data
  const supabase = await createClient()

  const { data: contract } = await supabase
    .from('contracts')
    .select('id, monthly_rate, start_date, end_date, slip_id')
    .eq('id', v.contract_id)
    .maybeSingle()
  if (!contract) return { ok: false, error: 'Contract not found.' }

  const { data, error } = await supabase
    .from('contract_amendments')
    .insert({
      xnid: `xnid:amendment:${randomUUID()}`,
      marina_id: v.marina_id,
      contract_id: v.contract_id,
      amendment_type: v.amendment_type,
      description: v.description ?? null,
      original_amount: contract.monthly_rate,
      new_amount: v.new_amount ?? null,
      original_start_date: contract.start_date,
      original_end_date: contract.end_date,
      new_start_date: v.new_start_date ?? null,
      new_end_date: v.new_end_date ?? null,
      original_slip_id: contract.slip_id,
      new_slip_id: v.new_slip_id ?? null,
      status: 'draft',
    })
    .select('id')
    .single()
  if (error || !data) return { ok: false, error: 'Could not create the amendment.' }
  await supabase.from('contracts').update({ status: 'amendment_required' }).eq('id', v.contract_id)
  revalidatePath(`/app/marina/${v.marina_id}/pms`)
  return { ok: true, data: { id: data.id } }
}

export async function sendAmendment(amendmentId: number, marinaId: number): Promise<PmsResult> {
  await requirePermission('marina', 'update')
  const supabase = await createClient()
  const { data: a } = await supabase
    .from('contract_amendments')
    .select('id, status')
    .eq('id', amendmentId)
    .maybeSingle()
  if (!a) return { ok: false, error: 'Amendment not found.' }
  if (a.status !== 'draft') return { ok: false, error: 'Only a draft amendment can be sent.' }
  await supabase.from('contract_amendments').update({ status: 'sent' }).eq('id', amendmentId)
  revalidatePath(`/app/marina/${marinaId}/pms`)
  return { ok: true }
}

/** `ContractController@signAmendment` + `applyAmendment`. */
export async function signAmendment(amendmentId: number, marinaId: number): Promise<PmsResult> {
  await requirePermission('marina', 'update')
  const supabase = await createClient()
  const { data: a } = await supabase
    .from('contract_amendments')
    .select(
      'id, status, applied_at, contract_id, new_amount, new_start_date, new_end_date, new_slip_id',
    )
    .eq('id', amendmentId)
    .maybeSingle()
  if (!a) return { ok: false, error: 'Amendment not found.' }
  if (a.status !== 'sent') return { ok: false, error: 'Amendment must be sent to sign.' }

  await supabase
    .from('contract_amendments')
    .update({ status: 'signed', signed_at: new Date().toISOString() })
    .eq('id', amendmentId)

  await applyAmendment(supabase, {
    id: a.id,
    contractId: a.contract_id,
    newAmount: a.new_amount,
    newStartDate: a.new_start_date,
    newEndDate: a.new_end_date,
    newSlipId: a.new_slip_id,
  })

  revalidatePath(`/app/marina/${marinaId}/pms`)
  return { ok: true }
}

async function applyAmendment(
  supabase: Awaited<ReturnType<typeof createClient>>,
  a: {
    id: number
    contractId: number
    newAmount: number | null
    newStartDate: string | null
    newEndDate: string | null
    newSlipId: number | null
  },
): Promise<void> {
  const patch: {
    monthly_rate?: number
    start_date?: string
    end_date?: string
    slip_id?: number
    status: string
  } = { status: 'active' }
  if (a.newAmount != null) patch.monthly_rate = a.newAmount
  if (a.newStartDate) patch.start_date = a.newStartDate.slice(0, 10)
  if (a.newEndDate) patch.end_date = a.newEndDate.slice(0, 10)
  if (a.newSlipId) patch.slip_id = a.newSlipId
  await supabase.from('contracts').update(patch).eq('id', a.contractId)
  await supabase
    .from('contract_amendments')
    .update({ applied_at: new Date().toISOString(), status: 'applied' })
    .eq('id', a.id)
}

// ===========================================================================
// public e-sign — the token flow behind app/contracts/sign/[token]
// ===========================================================================
export interface PublicSignResult {
  ok: boolean
  error?: string
  contractId?: number
  amendmentId?: number
}

/**
 * Consumes a `contract_sign_tokens` row and marks the contract (or amendment)
 * signed. No user session — the token is the authorization. Ports
 * `ContractController@signFromEmail`.
 */
export async function consumeSignToken(
  token: string,
  meta: { ip?: string | null; userAgent?: string | null },
): Promise<PublicSignResult> {
  const db = createServiceClient()

  const { data: tok } = await db
    .from('contract_sign_tokens')
    .select('token, contract_id, amendment_id, expires_at, used_at')
    .eq('token', token)
    .maybeSingle()
  if (!tok) return { ok: false, error: 'Invalid signing link.' }
  if (tok.used_at) return { ok: false, error: 'This link has already been used.' }
  if (new Date(tok.expires_at).getTime() < Date.now())
    return { ok: false, error: 'This signing link has expired.' }

  if (tok.amendment_id) {
    const { data: a } = await db
      .from('contract_amendments')
      .select('id, status, applied_at, contract_id, new_amount, new_start_date, new_end_date, new_slip_id')
      .eq('id', tok.amendment_id)
      .maybeSingle()
    if (!a) return { ok: false, error: 'Amendment not found.' }
    if (a.status === 'signed' || a.status === 'applied')
      return { ok: false, error: 'Amendment already signed.' }
    await db
      .from('contract_amendments')
      .update({ status: 'signed', signed_at: new Date().toISOString() })
      .eq('id', a.id)
    await applyAmendment(db as unknown as Awaited<ReturnType<typeof createClient>>, {
      id: a.id,
      contractId: a.contract_id,
      newAmount: a.new_amount,
      newStartDate: a.new_start_date,
      newEndDate: a.new_end_date,
      newSlipId: a.new_slip_id,
    })
    await db.from('contract_sign_tokens').update({ used_at: new Date().toISOString() }).eq('token', token)
    return { ok: true, amendmentId: a.id, contractId: a.contract_id }
  }

  const { data: contract } = await db
    .from('contracts')
    .select('id, reservation_id, user_id, signature, structured_terms')
    .eq('id', tok.contract_id)
    .maybeSingle()
  if (!contract) return { ok: false, error: 'Contract not found.' }
  if (contract.signature) return { ok: false, error: 'Contract already signed.' }

  const signature = {
    user_id: contract.user_id,
    timestamp: new Date().toISOString(),
    signature_hash: signatureHash(contract.structured_terms, contract.user_id),
    ip_address: meta.ip ?? null,
    user_agent: meta.userAgent ?? null,
    source: 'email',
  }
  await db
    .from('contracts')
    .update({ signature, status: 'signed', signed_at: new Date().toISOString() })
    .eq('id', contract.id)

  if (contract.reservation_id) {
    await db.from('reservations').update({ status: 'contract_signed' }).eq('id', contract.reservation_id)
    await db.from('assignments').update({ status: 'assigned' }).eq('reservation_id', contract.reservation_id)
    await db.from('stays').update({ status: 'expected' }).eq('reservation_id', contract.reservation_id)
  }
  await db.from('contract_sign_tokens').update({ used_at: new Date().toISOString() }).eq('token', token)

  // re-render the PDF now that it's signed (best effort)
  const stored = await renderAndStore(db as unknown as Awaited<ReturnType<typeof createClient>>, contract.id)
  if (stored) await db.from('contracts').update({ pdf_path: stored.path, pdf_url: stored.url }).eq('id', contract.id)

  return { ok: true, contractId: contract.id }
}

/** Form-action wrapper for the public sign page — captures IP + UA from headers. */
export async function submitSignToken(token: string): Promise<PublicSignResult> {
  const h = await headers()
  return consumeSignToken(token, {
    ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip'),
    userAgent: h.get('user-agent'),
  })
}

/** Mint a signing link for an amendment (admin action; email send is optional). */
export async function sendAmendmentSignLink(
  amendmentId: number,
  marinaId: number,
): Promise<PmsResult<{ signUrl: string }>> {
  await requirePermission('marina', 'update')
  const supabase = await createClient()
  const { data: a } = await supabase
    .from('contract_amendments')
    .select('id, contract_id, status')
    .eq('id', amendmentId)
    .maybeSingle()
  if (!a) return { ok: false, error: 'Amendment not found.' }
  if (a.status !== 'sent') return { ok: false, error: 'Send the amendment before creating a signing link.' }

  const db = createServiceClient()
  const token = randomBytes(32).toString('base64url')
  const { error } = await db.from('contract_sign_tokens').insert({
    token,
    contract_id: a.contract_id,
    amendment_id: a.id,
    expires_at: new Date(Date.now() + SIGN_TOKEN_TTL_HOURS * 3600 * 1000).toISOString(),
  })
  if (error) return { ok: false, error: 'Could not create the signing link.' }
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  revalidatePath(`/app/marina/${marinaId}/pms`)
  return { ok: true, data: { signUrl: `${baseUrl}/contracts/sign/${token}` } }
}
