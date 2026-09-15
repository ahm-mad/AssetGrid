import { mulberry32, series } from "@/lib/mock/dashboard"
import type { StatusKind } from "@/components/charts/status-dot"
import type { UserDeviceListResult, DeviceFleetSummary } from "@/lib/devices/data"

export interface MockDeviceRow {
  id: number
  name: string
  owner: string
  company: string
  product: string
  status: Extract<StatusKind, "online" | "warning" | "critical">
  battery: number | null
  signalDbm: number | null
  isCharging: boolean
  lastSeenMinutesAgo: number
}

export interface MockDeviceListResult {
  rows: MockDeviceRow[]
  total: number
  page: number
  perPage: number
  totalPages: number
}

export interface MockFleetSummary {
  total: number
  captured: number
  charging: number
  alerting: number
  history: { total: number[]; alerting: number[] }
}

const COMPANIES = ["Harborline Marinas", "Northstar Facilities", "BlueWater Group", "Summit Property Co.", "Coastal Ops"]
const PRODUCTS = ["eMAX Duplex", "MAX Switch", "Bilgemax Monitoring Kit", "Command Charge Controller", "Sensor Node"]
const OWNERS = [
  "Alicia Ferreira", "Marcus Wei", "Priya Nair", "Tomas Bergström", "Jade Whitfield",
  "Diego Ramos", "Fatima Al-Sayed", "Owen Chalmers", "Nadia Volkov", "Sam Okafor",
]

const DEVICES: MockDeviceRow[] = buildDevices()

function buildDevices(): MockDeviceRow[] {
  const rand = mulberry32(2024)
  const rows: MockDeviceRow[] = []
  for (let i = 1; i <= 48; i++) {
    const roll = rand()
    const status: MockDeviceRow["status"] = roll > 0.88 ? "critical" : roll > 0.72 ? "warning" : "online"
    const product = PRODUCTS[Math.floor(rand() * PRODUCTS.length)]
    rows.push({
      id: i,
      name: `${product.split(" ")[0]}-${String(i).padStart(3, "0")}`,
      owner: OWNERS[Math.floor(rand() * OWNERS.length)],
      company: COMPANIES[Math.floor(rand() * COMPANIES.length)],
      product,
      status,
      battery: status === "critical" && rand() > 0.5 ? null : Math.round(8 + rand() * 92),
      signalDbm: status === "critical" ? null : Math.round(-95 + rand() * 55),
      isCharging: status !== "critical" && rand() > 0.6,
      lastSeenMinutesAgo: status === "critical" ? Math.round(60 + rand() * 2000) : Math.round(rand() * 40),
    })
  }
  return rows
}

export function listMockDevices({
  page = 1,
  perPage = 25,
  search = "",
}: {
  page?: number
  perPage?: number
  search?: string
}): MockDeviceListResult {
  const q = search.trim().toLowerCase()
  const filtered = q
    ? DEVICES.filter((d) => `${d.name} ${d.owner} ${d.company} ${d.product}`.toLowerCase().includes(q))
    : DEVICES

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const start = (page - 1) * perPage
  const rows = filtered.slice(start, start + perPage)

  return { rows, total, page, perPage, totalPages }
}

export function getMockFleetSummary(): MockFleetSummary {
  const total = DEVICES.length
  const captured = DEVICES.filter((d) => d.status !== "critical").length
  const charging = DEVICES.filter((d) => d.isCharging).length
  const alerting = DEVICES.filter((d) => d.status === "critical").length

  return {
    total,
    captured,
    charging,
    alerting,
    history: {
      total: series(14, total - 4, 3, 5),
      alerting: series(14, alerting, 2, 19),
    },
  }
}

/** Real-data fallback for when UI_MOCK_MODE is off — see STATUS.md §2 pattern. */
export function mapRealFleetToView(summary: DeviceFleetSummary): MockFleetSummary {
  return {
    total: summary.total,
    captured: summary.captured,
    charging: summary.charging,
    alerting: summary.alerting,
    history: { total: [summary.total], alerting: [summary.alerting] },
  }
}

/** Real-data fallback — the real list doesn't have battery/signal/company yet, so those degrade to null/blank. */
export function mapRealListToView(result: UserDeviceListResult): MockDeviceListResult {
  return {
    total: result.total,
    page: result.page,
    perPage: result.perPage,
    totalPages: result.totalPages,
    rows: result.rows.map((d) => ({
      id: d.id,
      name: d.deviceName ?? `Device #${d.id}`,
      owner: d.ownerName ?? "—",
      company: "",
      product: d.productName ?? "—",
      status: d.status === "captured" ? "online" : "critical",
      battery: null,
      signalDbm: null,
      isCharging: d.isCharging,
      lastSeenMinutesAgo: d.lastReadingAt
        ? Math.max(0, Math.round((Date.now() - new Date(d.lastReadingAt).getTime()) / 60000))
        : 999_999,
    })),
  }
}
