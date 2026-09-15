import { mulberry32, series } from "@/lib/mock/dashboard"
import type { UserListResult, CustomerSummary } from "@/lib/users/data"

export interface MockCustomerRow {
  id: string
  name: string
  roleTitle: string
  companyName: string
  createdAt: string
  deletedAt: string | null
}

export interface MockCustomerListResult {
  rows: MockCustomerRow[]
  total: number
  page: number
  perPage: number
  totalPages: number
}

export interface MockCustomerSummary extends CustomerSummary {
  history: number[]
}

const COMPANIES = ["Harborline Marinas", "Northstar Facilities", "BlueWater Group", "Summit Property Co.", "Coastal Ops"]
const ROLES = ["Customer", "Manager", "Dealer", "Partner", "Admin"]
const FIRST = ["Alicia", "Marcus", "Priya", "Tomas", "Jade", "Diego", "Fatima", "Owen", "Nadia", "Sam", "Elena", "Kai", "Rosa", "Iris", "Noah", "Maya", "Leo", "Zara", "Finn", "Aya"]
const LAST = ["Ferreira", "Wei", "Nair", "Bergström", "Whitfield", "Ramos", "Al-Sayed", "Chalmers", "Volkov", "Okafor"]

const CUSTOMERS: MockCustomerRow[] = buildCustomers()

function buildCustomers(): MockCustomerRow[] {
  const rand = mulberry32(555)
  const rows: MockCustomerRow[] = []
  for (let i = 1; i <= 42; i++) {
    rows.push({
      id: `mock-user-${i}`,
      name: `${FIRST[i % FIRST.length]} ${LAST[Math.floor(i / 3) % LAST.length]}`,
      roleTitle: ROLES[Math.floor(rand() * ROLES.length)],
      companyName: COMPANIES[Math.floor(rand() * COMPANIES.length)],
      createdAt: new Date(Date.now() - Math.round(rand() * 500) * 86_400_000).toISOString(),
      deletedAt: rand() > 0.94 ? new Date().toISOString() : null,
    })
  }
  return rows
}

export function listMockCustomers({
  page = 1,
  perPage = 20,
  search = "",
}: {
  page?: number
  perPage?: number
  search?: string
}): MockCustomerListResult {
  const q = search.trim().toLowerCase()
  const filtered = q
    ? CUSTOMERS.filter((c) => `${c.name} ${c.companyName}`.toLowerCase().includes(q))
    : CUSTOMERS

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const start = (page - 1) * perPage

  return { rows: filtered.slice(start, start + perPage), total, page, perPage, totalPages }
}

export function getMockCustomerSummary(): MockCustomerSummary {
  const perCompany = COMPANIES.map((label) => ({
    label,
    value: CUSTOMERS.filter((c) => c.companyName === label && !c.deletedAt).length,
  }))

  return {
    total: CUSTOMERS.filter((c) => !c.deletedAt).length,
    companyCount: COMPANIES.length,
    perCompany,
    history: series(14, CUSTOMERS.length - 6, 3, 71),
  }
}

export function mapRealListToView(result: UserListResult): MockCustomerListResult {
  return {
    total: result.total,
    page: result.page,
    perPage: result.perPage,
    totalPages: result.totalPages,
    rows: result.rows.map((u) => ({
      id: u.id,
      name: [u.firstName, u.lastName].filter(Boolean).join(" ") || "—",
      roleTitle: u.roleTitle,
      companyName: u.companyName ?? "—",
      createdAt: u.createdAt,
      deletedAt: u.deletedAt,
    })),
  }
}

export function mapRealSummaryToView(summary: CustomerSummary): MockCustomerSummary {
  return { ...summary, history: [summary.total] }
}
