import { mulberry32 } from "@/lib/mock/dashboard"
import type { DeviceDiagnosticRow, Paginated } from "@/lib/analytics/data"
import type { RevenueReport, OccupancyReport, ArSummaryReport } from "@/lib/marina/pms/reports"
import type { FleetGroup } from "@/components/charts/network-map"

const COMPANIES = ["Harborline Marinas", "Northstar Facilities", "BlueWater Group", "Summit Property Co.", "Coastal Ops"]
const PRODUCTS = ["eMAX Duplex", "MAX Switch", "Bilgemax Monitoring Kit", "Command Charge Controller", "Sensor Node"]

function buildDiagnostics(): DeviceDiagnosticRow[] {
  const rand = mulberry32(4242)
  return Array.from({ length: 48 }, (_, i) => {
    const alertCount = rand() > 0.85 ? Math.round(rand() * 3) + 1 : 0
    const malfunction = rand() > 0.93
    return {
      deveui: `EUI${(1000000000000000 + i).toString(16).toUpperCase()}`,
      email: `owner${i}@assetgrid.test`,
      xnid: `XN-${String(i + 1).padStart(4, "0")}`,
      companyName: COMPANIES[i % COMPANIES.length],
      placeInfo: `Dock ${1 + (i % 5)}, Slip ${1 + (i % 12)}`,
      productId: (i % PRODUCTS.length) + 1,
      productName: PRODUCTS[i % PRODUCTS.length],
      notifiName: "SMS + Email",
      notifiId: 1,
      attributeIds: [],
      appName: null,
      userDeviceId: i + 1,
      inventoryDeviceId: i + 1,
      alertCount,
      normalCount: Math.round(rand() * 500),
      totalPackets: Math.round(rand() * 5000),
      latestPacket: null,
      malfunction,
      bypassActive: false,
      malfunctionActiveStatus: malfunction ? "active" : "none",
      malfunctionAttributes: malfunction ? ["Low battery voltage"] : [],
      xupJsonBody: null,
    }
  })
}

const DIAGNOSTICS = buildDiagnostics()

export function listMockDeviceDiagnostics({
  page = 1,
  perPage = 25,
  search = "",
}: {
  page?: number
  perPage?: number
  search?: string
}): Paginated<DeviceDiagnosticRow> {
  const q = search.trim().toLowerCase()
  const filtered = q
    ? DIAGNOSTICS.filter((d) => `${d.deveui} ${d.xnid} ${d.email}`.toLowerCase().includes(q))
    : DIAGNOSTICS
  const total = filtered.length
  const start = (page - 1) * perPage
  return {
    rows: filtered.slice(start, start + perPage),
    total,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  }
}

/**
 * Device count by product line across the *entire* mock diagnostics set
 * (not just the current page) — the reference's "Product Estate" pattern
 * applied to this page's actual data. Mock-only: a real equivalent would
 * need its own aggregate query, deferred backend work (ADR-UX005 §7).
 */
export function getMockProductBreakdown(): FleetGroup[] {
  const groups = new Map<string, DeviceDiagnosticRow[]>()
  for (const d of DIAGNOSTICS) {
    const key = d.productName ?? "Unknown"
    const list = groups.get(key) ?? []
    list.push(d)
    groups.set(key, list)
  }
  return [...groups.entries()].map(([label, rows]) => {
    const reporting = rows.filter((r) => r.totalPackets > 0).length
    const hasMalfunction = rows.some((r) => r.malfunction)
    const hasAlerts = rows.some((r) => r.alertCount > 0)
    return {
      id: label,
      label,
      deviceCount: rows.length,
      onlinePct: Math.round((reporting / rows.length) * 100),
      status: hasMalfunction ? "critical" : hasAlerts ? "warning" : "online",
    }
  })
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const HOUR_LABELS = ["00", "04", "08", "12", "16", "20"]

/** A 7-day × 6-hourly-bucket telemetry-volume heatmap — a different visual shape than any bar/card grid elsewhere. */
export function getMockTelemetryHeatmap(): { rowLabels: string[]; colLabels: string[]; data: number[][] } {
  const rand = mulberry32(606)
  const data = DAY_LABELS.map((_, day) =>
    HOUR_LABELS.map((_, hourBucket) => {
      // Business-hours-ish curve (peaks mid-day), lighter on weekends.
      const dayFactor = day >= 5 ? 0.55 : 1
      const hourFactor = 1 - Math.abs(hourBucket - 2.5) / 3.5
      return Math.round((200 + hourFactor * 900) * dayFactor * (0.75 + rand() * 0.5))
    }),
  )
  return { rowLabels: DAY_LABELS, colLabels: HOUR_LABELS.map((h) => `${h}:00`), data }
}

export function getMockRevenueReport(): RevenueReport {
  const perDock = [
    { dockId: 1, dockName: "Dock A", revenue: 4200 },
    { dockId: 2, dockName: "Dock B", revenue: 3150 },
    { dockId: 3, dockName: "Dock C", revenue: 5680 },
  ]
  return { perSlip: [], perDock }
}

export function getMockOccupancyReport(): OccupancyReport {
  return {
    perDock: [
      { dockId: 1, dockName: "Dock A", occupancyPercent: 78 },
      { dockId: 2, dockName: "Dock B", occupancyPercent: 62 },
      { dockId: 3, dockName: "Dock C", occupancyPercent: 91 },
    ],
  }
}

export function getMockArSummary(): ArSummaryReport {
  return {
    perCompany: COMPANIES.map((companyName, i) => ({
      companyId: i + 1,
      companyName,
      totalAr: [1200, 850, 2100, 430, 0][i] ?? 0,
      aging: {
        "0-30": [800, 500, 1400, 200, 0][i] ?? 0,
        "31-60": [300, 200, 500, 130, 0][i] ?? 0,
        "61-90": [100, 100, 150, 100, 0][i] ?? 0,
        "90+": [0, 50, 50, 0, 0][i] ?? 0,
      },
    })),
  }
}
