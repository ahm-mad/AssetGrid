import { mulberry32, series } from "@/lib/mock/dashboard"
import type { Paginated, EntitlementRow, ActivationAttemptRow, PaymentRow, PlanRow } from "@/lib/billing/data"
import type { FleetGroup } from "@/components/charts/network-map"

const PLANS = [
  "Command Annual Protection Plan",
  "Bilgemax One Monitoring Kit",
  "eMAX Charge Standard",
  "Sensor Node Basic",
  "Fleet Pro Bundle",
]
const OWNERS = ["Alicia Ferreira", "Marcus Wei", "Priya Nair", "Tomas Bergström", "Jade Whitfield", "Diego Ramos"]
const EMAILS = ["alicia@harborline.test", "marcus@northstar.test", "priya@bluewater.test", "tomas@summitprop.test", "jade@coastalops.test"]
const BILLING_MODES = ["direct", "dealer_assisted", "dealer_billed"] as const
const ENT_STATUSES = ["active", "active", "active", "cancelled", "pending"]
const ATTEMPT_STATUSES = ["completed", "completed", "pending", "failed"]

export interface MockBillingSummary {
  activeCount: number
  totalCollected: number
  entitlements: Paginated<EntitlementRow>
  attempts: Paginated<ActivationAttemptRow>
  payments: Paginated<PaymentRow>
  planChart: { label: string; value: number }[]
  history: number[]
}

function paginate<T>(rows: T[], page: number, perPage: number): Paginated<T> {
  const total = rows.length
  return {
    rows: rows.slice((page - 1) * perPage, page * perPage),
    total,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  }
}

export const MOCK_PLANS: PlanRow[] = PLANS.map((name, i) => ({
  id: i + 1,
  planCode: name.toUpperCase().replace(/\s+/g, "_").slice(0, 20),
  name,
  planFamily: i % 2 === 0 ? "Protection" : "Monitoring",
  deviceLimit: [5, 10, 25, 50, -1][i] ?? 10,
  amount: [49, 99, 149, 19, 249][i] ?? 99,
  billingType: "recurring",
  billingInterval: "year",
  billingModes: [...BILLING_MODES],
  activationType: "self_serve",
  requiresProvisioning: i % 3 === 0,
  maxDevicesPerBatch: null,
  stripeProductId: `prod_mock_${i + 1}`,
  stripePriceId: `price_mock_${i + 1}`,
  provisioningPriceId: null,
  xeroRevenueCode: null,
  xeroAccountCode: null,
  tags: null,
  notes: null,
  isActive: true,
  deletedAt: null,
}))

function buildEntitlements(): EntitlementRow[] {
  const rand = mulberry32(313)
  return Array.from({ length: 34 }, (_, i) => {
    const planName = PLANS[Math.floor(rand() * PLANS.length)]
    const status = ENT_STATUSES[Math.floor(rand() * ENT_STATUSES.length)]
    return {
      id: i + 1,
      planId: PLANS.indexOf(planName) + 1,
      planName,
      planCode: planName.toUpperCase().replace(/\s+/g, "_").slice(0, 20),
      userId: `mock-user-${i}`,
      userName: OWNERS[i % OWNERS.length],
      ownerXnid: null,
      billingXnid: null,
      dealerXnid: null,
      billingMode: BILLING_MODES[Math.floor(rand() * BILLING_MODES.length)],
      source: rand() > 0.5 ? "checkout" : "admin",
      paymentProvider: "stripe",
      providerCustomerId: null,
      providerSubscriptionId: null,
      maxDevicesAllowed: rand() > 0.7 ? -1 : Math.round(2 + rand() * 8),
      activeDeviceCount: Math.round(rand() * 6),
      status,
      startedAt: new Date(Date.now() - i * 5 * 86_400_000).toISOString(),
      cancelledAt: status === "cancelled" ? new Date().toISOString() : null,
      createdAt: new Date(Date.now() - i * 5 * 86_400_000).toISOString(),
    }
  })
}

function buildAttempts(): ActivationAttemptRow[] {
  const rand = mulberry32(717)
  return Array.from({ length: 22 }, (_, i) => ({
    id: i + 1,
    email: EMAILS[i % EMAILS.length],
    userId: null,
    planCode: PLANS[Math.floor(rand() * PLANS.length)].toUpperCase().replace(/\s+/g, "_").slice(0, 20),
    deviceCount: Math.round(1 + rand() * 4),
    billingMode: BILLING_MODES[Math.floor(rand() * BILLING_MODES.length)],
    paymentProvider: "stripe",
    status: ATTEMPT_STATUSES[Math.floor(rand() * ATTEMPT_STATUSES.length)],
    checkoutSessionId: `cs_test_${(1000 + i).toString(36)}`,
    completedAt: rand() > 0.4 ? new Date().toISOString() : null,
    createdAt: new Date(Date.now() - i * 7 * 3_600_000).toISOString(),
  }))
}

function buildPayments(): PaymentRow[] {
  const rand = mulberry32(919)
  return Array.from({ length: 28 }, (_, i) => ({
    id: i + 1,
    xnid: null,
    providerInvoiceId: `in_${(2000 + i).toString(36)}`,
    paymentProvider: "stripe",
    paymentMethod: "card",
    amount: Math.round((15 + rand() * 180) * 100) / 100,
    createdAt: new Date(Date.now() - i * 11 * 3_600_000).toISOString(),
    cardLast4: String(1000 + Math.floor(rand() * 9000)).slice(-4),
    cardBrand: rand() > 0.5 ? "visa" : "mastercard",
  }))
}

const ENTITLEMENTS = buildEntitlements()
const ATTEMPTS = buildAttempts()
const PAYMENTS = buildPayments()

export function getMockBillingSummary(): MockBillingSummary {
  const perPlan = new Map<string, number>()
  for (const e of ENTITLEMENTS) {
    const name = e.planName ?? "Unknown"
    perPlan.set(name, (perPlan.get(name) ?? 0) + 1)
  }

  return {
    activeCount: ENTITLEMENTS.filter((e) => e.status === "active").length,
    totalCollected: PAYMENTS.reduce((s, p) => s + p.amount, 0),
    entitlements: paginate(ENTITLEMENTS, 1, 50),
    attempts: paginate(ATTEMPTS, 1, 50),
    payments: paginate(PAYMENTS, 1, 50),
    planChart: [...perPlan.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value })),
    history: series(14, 22, 4, 313),
  }
}

/**
 * Entitlement health by plan — a different lens than the "Entitlements by
 * plan" bar chart (which is raw counts): this shows active-rate and flags
 * plans with a high cancellation share. Reference's "Product Estate"
 * pattern applied to billing's own natural grouping (ADR-UX005 §7).
 */
export function getMockPlanHealth(): FleetGroup[] {
  const groups = new Map<string, EntitlementRow[]>()
  for (const e of ENTITLEMENTS) {
    const name = e.planName ?? "Unknown"
    const list = groups.get(name) ?? []
    list.push(e)
    groups.set(name, list)
  }
  return [...groups.entries()].map(([label, rows]) => {
    const active = rows.filter((r) => r.status === "active").length
    const cancelled = rows.filter((r) => r.status === "cancelled").length
    const cancelRate = cancelled / rows.length
    return {
      id: label,
      label,
      deviceCount: rows.length,
      onlinePct: Math.round((active / rows.length) * 100),
      status: cancelRate > 0.25 ? "critical" : cancelRate > 0 ? "warning" : "online",
    }
  })
}
