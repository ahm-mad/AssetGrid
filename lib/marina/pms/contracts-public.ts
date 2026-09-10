import 'server-only'

import { createServiceClient } from '@/utils/supabase/service'

/**
 * Read side of the public contract e-sign page (`app/contracts/sign/[token]`).
 * No user session — the token is the authorization, so this uses the service
 * client. Returns just enough to show the signer what they're agreeing to.
 */

export interface SignTokenPreview {
  token: string
  valid: boolean
  reason?: string
  kind: 'contract' | 'amendment'
  contractId: number
  amendmentId?: number
  marinaName: string
  boatName: string | null
  slipName: string | null
  customerName: string | null
  startDate: string | null
  endDate: string | null
  monthlyRate: number
  structuredTerms: Record<string, string | null> | null
  alreadySigned: boolean
  amendment?: {
    type: string
    description: string | null
    newAmount: number | null
    newStartDate: string | null
    newEndDate: string | null
  }
}

export async function getSignTokenPreview(token: string): Promise<SignTokenPreview | null> {
  const db = createServiceClient()
  const { data: tok } = await db
    .from('contract_sign_tokens')
    .select('token, contract_id, amendment_id, expires_at, used_at')
    .eq('token', token)
    .maybeSingle()
  if (!tok) return null

  const { data: c } = await db
    .from('contracts')
    .select(
      'id, status, monthly_rate, start_date, end_date, signature, structured_terms, boat:boats(boat_name), slip:slips(name), customer:profiles(first_name, last_name), marina:marinas(marina_name, marina_code)',
    )
    .eq('id', tok.contract_id)
    .maybeSingle()
  if (!c) return null

  const marina = c.marina as { marina_name?: string | null; marina_code?: string | null } | null
  const cust = c.customer as { first_name?: string | null; last_name?: string | null } | null

  let valid = true
  let reason: string | undefined
  if (tok.used_at) {
    valid = false
    reason = 'This link has already been used.'
  } else if (new Date(tok.expires_at).getTime() < Date.now()) {
    valid = false
    reason = 'This signing link has expired.'
  }

  let amendment: SignTokenPreview['amendment']
  if (tok.amendment_id) {
    const { data: a } = await db
      .from('contract_amendments')
      .select('amendment_type, description, new_amount, new_start_date, new_end_date, status')
      .eq('id', tok.amendment_id)
      .maybeSingle()
    if (a) {
      amendment = {
        type: a.amendment_type,
        description: a.description,
        newAmount: a.new_amount == null ? null : Number(a.new_amount),
        newStartDate: a.new_start_date,
        newEndDate: a.new_end_date,
      }
      if (['signed', 'applied'].includes(a.status)) {
        valid = false
        reason = 'This amendment has already been signed.'
      }
    }
  }

  const alreadySigned = tok.amendment_id ? false : c.signature != null
  if (alreadySigned) {
    valid = false
    reason = 'This contract has already been signed.'
  }

  return {
    token,
    valid,
    reason,
    kind: tok.amendment_id ? 'amendment' : 'contract',
    contractId: c.id,
    amendmentId: tok.amendment_id ?? undefined,
    marinaName: marina?.marina_name || marina?.marina_code || 'Marina',
    boatName: (c.boat as { boat_name?: string | null } | null)?.boat_name ?? null,
    slipName: (c.slip as { name?: string | null } | null)?.name ?? null,
    customerName: cust ? [cust.first_name, cust.last_name].filter(Boolean).join(' ') || null : null,
    startDate: c.start_date,
    endDate: c.end_date,
    monthlyRate: Number(c.monthly_rate ?? 0),
    structuredTerms: (c.structured_terms as Record<string, string | null> | null) ?? null,
    alreadySigned,
    amendment,
  }
}
