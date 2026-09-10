import 'server-only'

import { createClient } from '@/utils/supabase/server'
import type { Database } from '@/lib/database.types'

/**
 * Billing / provisioning reads — ports the `plans`, `subscription_entitlements`,
 * `activation_attempts`, `payments` query surface. RLS: `commerce` readers see
 * everything; a plain user sees only their own `activation_attempts`.
 */

type BillingMode = Database['public']['Enums']['billing_mode']

export interface PlanRow {
  id: number
  planCode: string
  name: string
  planFamily: string
  deviceLimit: number
  amount: number | null
  billingType: string
  billingInterval: string | null
  billingModes: BillingMode[]
  activationType: string
  requiresProvisioning: boolean
  maxDevicesPerBatch: number | null
  stripeProductId: string | null
  stripePriceId: string | null
  provisioningPriceId: string | null
  xeroRevenueCode: string | null
  xeroAccountCode: string | null
  tags: string | null
  notes: string | null
  isActive: boolean
  deletedAt: string | null
}

function toPlan(p: Database['public']['Tables']['plans']['Row']): PlanRow {
  return {
    id: p.id,
    planCode: p.plan_code,
    name: p.name,
    planFamily: p.plan_family,
    deviceLimit: p.device_limit,
    amount: p.amount,
    billingType: p.billing_type,
    billingInterval: p.billing_interval,
    billingModes: p.billing_modes ?? [],
    activationType: p.activation_type,
    requiresProvisioning: p.requires_provisioning,
    maxDevicesPerBatch: p.max_devices_per_batch,
    stripeProductId: p.stripe_product_id,
    stripePriceId: p.stripe_price_id,
    provisioningPriceId: p.provisioning_price_id,
    xeroRevenueCode: p.xero_revenue_code,
    xeroAccountCode: p.xero_account_code,
    tags: p.tags,
    notes: p.notes,
    isActive: p.is_active,
    deletedAt: p.deleted_at,
  }
}

export async function listPlans(includeDeleted = false): Promise<PlanRow[]> {
  const supabase = await createClient()
  let query = supabase.from('plans').select('*').order('plan_code')
  if (!includeDeleted) query = query.is('deleted_at', null)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map(toPlan)
}

export async function getPlan(id: number): Promise<PlanRow | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('plans').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data ? toPlan(data) : null
}

// ---------------------------------------------------------------------------
// Entitlements
// ---------------------------------------------------------------------------
export interface EntitlementRow {
  id: number
  planId: number
  planName: string | null
  planCode: string | null
  userId: string | null
  userName: string | null
  ownerXnid: string | null
  billingXnid: string | null
  dealerXnid: string | null
  billingMode: BillingMode
  source: string
  paymentProvider: string
  providerCustomerId: string | null
  providerSubscriptionId: string | null
  maxDevicesAllowed: number | null
  activeDeviceCount: number
  status: string
  startedAt: string | null
  cancelledAt: string | null
  createdAt: string
}

export interface EntitlementAssignment {
  id: number
  xnid: string
  status: string
  assignedAt: string
  deviceName: string | null
  userDeviceId: number | null
}

export interface EntitlementDetail extends EntitlementRow {
  assignments: EntitlementAssignment[]
}

export interface Paginated<T> {
  rows: T[]
  total: number
  page: number
  perPage: number
  totalPages: number
}

const ENT_SELECT =
  'id, plan_id, user_id, owner_xnid, billing_xnid, dealer_xnid, billing_mode, source, payment_provider, provider_customer_id, provider_subscription_id, max_devices_allowed, active_device_count, status, started_at, cancelled_at, created_at, plan:plans(name, plan_code), owner:profiles(first_name, last_name, xnid)'

type EntEmbedded = {
  id: number
  plan_id: number
  user_id: string | null
  owner_xnid: string | null
  billing_xnid: string | null
  dealer_xnid: string | null
  billing_mode: BillingMode
  source: string
  payment_provider: string
  provider_customer_id: string | null
  provider_subscription_id: string | null
  max_devices_allowed: number | null
  active_device_count: number
  status: string
  started_at: string | null
  cancelled_at: string | null
  created_at: string
  plan: { name: string | null; plan_code: string | null } | null
  owner: { first_name: string | null; last_name: string | null; xnid: string | null } | null
}

function toEnt(e: EntEmbedded): EntitlementRow {
  const o = e.owner
  return {
    id: e.id,
    planId: e.plan_id,
    planName: e.plan?.name ?? null,
    planCode: e.plan?.plan_code ?? null,
    userId: e.user_id,
    userName: o ? [o.first_name, o.last_name].filter(Boolean).join(' ') || o.xnid || null : null,
    ownerXnid: e.owner_xnid,
    billingXnid: e.billing_xnid,
    dealerXnid: e.dealer_xnid,
    billingMode: e.billing_mode,
    source: e.source,
    paymentProvider: e.payment_provider,
    providerCustomerId: e.provider_customer_id,
    providerSubscriptionId: e.provider_subscription_id,
    maxDevicesAllowed: e.max_devices_allowed,
    activeDeviceCount: e.active_device_count,
    status: e.status,
    startedAt: e.started_at,
    cancelledAt: e.cancelled_at,
    createdAt: e.created_at,
  }
}

export async function listEntitlements(params: {
  page?: number
  perPage?: number
  status?: string
  userId?: string
} = {}): Promise<Paginated<EntitlementRow>> {
  const page = Math.max(1, params.page ?? 1)
  const perPage = Math.min(100, Math.max(1, params.perPage ?? 20))
  const from = (page - 1) * perPage

  const supabase = await createClient()
  let query = supabase.from('subscription_entitlements').select(ENT_SELECT, { count: 'exact' })
  if (params.status) query = query.eq('status', params.status)
  if (params.userId) query = query.eq('user_id', params.userId)

  const { data, count, error } = await query
    .order('id', { ascending: false })
    .range(from, from + perPage - 1)
  if (error) throw error

  const total = count ?? 0
  return {
    rows: (data ?? []).map((r) => toEnt(r as unknown as EntEmbedded)),
    total,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  }
}

export async function getEntitlement(id: number): Promise<EntitlementDetail | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('subscription_entitlements')
    .select(ENT_SELECT)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const base = toEnt(data as unknown as EntEmbedded)

  const { data: assigns } = await supabase
    .from('device_assignments')
    .select('id, xnid, status, assigned_at')
    .eq('entitlement_id', id)
    .order('id')

  const xnids = (assigns ?? []).map((a) => a.xnid)
  const deviceByXnid = new Map<string, { id: number; device_name: string | null }>()
  if (xnids.length > 0) {
    const { data: devs } = await supabase
      .from('user_devices')
      .select('id, xnid, device_name')
      .in('xnid', xnids)
    for (const d of devs ?? []) if (d.xnid) deviceByXnid.set(d.xnid, d)
  }

  return {
    ...base,
    assignments: (assigns ?? []).map((a) => ({
      id: a.id,
      xnid: a.xnid,
      status: a.status,
      assignedAt: a.assigned_at,
      deviceName: deviceByXnid.get(a.xnid)?.device_name ?? null,
      userDeviceId: deviceByXnid.get(a.xnid)?.id ?? null,
    })),
  }
}

// ---------------------------------------------------------------------------
// Activation attempts
// ---------------------------------------------------------------------------
export interface ActivationAttemptRow {
  id: number
  email: string
  userId: string | null
  planCode: string | null
  deviceCount: number
  billingMode: BillingMode
  paymentProvider: string
  status: string
  checkoutSessionId: string | null
  completedAt: string | null
  createdAt: string
}

export async function listActivationAttempts(params: {
  page?: number
  perPage?: number
  status?: Database['public']['Enums']['activation_attempt_status']
} = {}): Promise<Paginated<ActivationAttemptRow>> {
  const page = Math.max(1, params.page ?? 1)
  const perPage = Math.min(100, Math.max(1, params.perPage ?? 20))
  const from = (page - 1) * perPage

  const supabase = await createClient()
  let query = supabase
    .from('activation_attempts')
    .select(
      'id, email, user_id, device_count, billing_mode, payment_provider, status, checkout_session_id, completed_at, created_at, plan:plans(plan_code)',
      { count: 'exact' },
    )
  if (params.status) query = query.eq('status', params.status)

  const { data, count, error } = await query
    .order('id', { ascending: false })
    .range(from, from + perPage - 1)
  if (error) throw error

  const total = count ?? 0
  return {
    rows: (data ?? []).map((a) => ({
      id: a.id,
      email: a.email,
      userId: a.user_id,
      planCode: (a.plan as { plan_code?: string } | null)?.plan_code ?? null,
      deviceCount: a.device_count,
      billingMode: a.billing_mode,
      paymentProvider: a.payment_provider,
      status: a.status,
      checkoutSessionId: a.checkout_session_id,
      completedAt: a.completed_at,
      createdAt: a.created_at,
    })),
    total,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  }
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------
export interface PaymentRow {
  id: number
  xnid: string | null
  providerInvoiceId: string | null
  paymentProvider: string
  paymentMethod: string | null
  amount: number
  createdAt: string
  cardLast4: string | null
  cardBrand: string | null
}

export async function listPayments(params: { page?: number; perPage?: number } = {}): Promise<
  Paginated<PaymentRow>
> {
  const page = Math.max(1, params.page ?? 1)
  const perPage = Math.min(100, Math.max(1, params.perPage ?? 20))
  const from = (page - 1) * perPage

  const supabase = await createClient()
  const { data, count, error } = await supabase
    .from('payments')
    .select(
      'id, xnid, provider_invoice_id, payment_provider, payment_method, amount, created_at, detail:payment_details(card_last4, card_brand)',
      { count: 'exact' },
    )
    .order('id', { ascending: false })
    .range(from, from + perPage - 1)
  if (error) throw error

  const total = count ?? 0
  return {
    rows: (data ?? []).map((p) => {
      const d = (Array.isArray(p.detail) ? p.detail[0] : p.detail) as
        | { card_last4: string | null; card_brand: string | null }
        | null
      return {
        id: p.id,
        xnid: p.xnid,
        providerInvoiceId: p.provider_invoice_id,
        paymentProvider: p.payment_provider,
        paymentMethod: p.payment_method,
        amount: Number(p.amount),
        createdAt: p.created_at,
        cardLast4: d?.card_last4 ?? null,
        cardBrand: d?.card_brand ?? null,
      }
    }),
    total,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  }
}

/** Users to offer in the "start activation" picker (recent profiles). */
export async function getActivationUserOptions(): Promise<
  { id: string; name: string; xnid: string | null }[]
> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, xnid, role:role_types!profiles_role_type_id_fkey(title)')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw error
  return (data ?? []).map((p) => ({
    id: p.id,
    name:
      [p.first_name, p.last_name].filter(Boolean).join(' ') ||
      (p.role as { title?: string } | null)?.title ||
      p.xnid ||
      p.id,
    xnid: p.xnid,
  }))
}

/** Devices a user could still activate (status not yet 'captured'). */
export async function listActivatableUserDevices(
  userId: string,
): Promise<{ id: number; xnid: string | null; deviceName: string | null; status: string }[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('user_devices')
    .select('id, xnid, device_name, status')
    .eq('user_id', userId)
    .neq('status', 'captured')
    .order('id')
  if (error) throw error
  return (data ?? []).map((d) => ({
    id: d.id,
    xnid: d.xnid,
    deviceName: d.device_name,
    status: d.status,
  }))
}
