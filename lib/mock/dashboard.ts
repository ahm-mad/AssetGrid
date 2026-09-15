/**
 * Dummy dashboard dataset for UI_MOCK_MODE (see lib/mock/enabled.ts). Shaped
 * for the Ops Console redesign's components (sparklines, radial gauge, the
 * per-site and per-device-type fleet grids, live feed) — richer than the
 * real `DashboardSummary` because those components don't have backend
 * fields yet; deciding whether each of these gets wired to a real query is
 * deliberately deferred to a later session (see STATUS.md).
 */

import type { FleetGroup } from "@/components/charts/network-map"

export type Severity = "critical" | "warning" | "info"

export interface KpiTrend {
  label: string
  value: number
  unit?: string
  delta: number
  history: number[]
  status?: "online" | "warning" | "critical"
}

export interface FeedItem {
  id: string
  severity: Severity
  title: string
  detail: string
  source: string
  minutesAgo: number
}

export interface MockDashboardData {
  kpis: {
    devices: KpiTrend
    openAlerts: KpiTrend
    uptime: KpiTrend
    telemetryRate: KpiTrend
  }
  statusBreakdown: { label: string; value: number; color: string }[]
  telemetry: { label: string; value: number }[]
  byCompany: { label: string; value: number }[]
  sites: FleetGroup[]
  deviceTypes: FleetGroup[]
  feed: FeedItem[]
}

/** Shape of the real (Supabase-backed) dashboard summary — kept local to avoid importing the `server-only` module from a place a client boundary might reach. */
export interface RealDashboardSummary {
  deviceCount: number
  openAlertCount: number
  buildingCount: number
  marinaCount: number
  customerCount: number
  activity: { label: string; value: number }[]
  recentAlerts: { id: number; deviceName: string | null; message: string; createdAt: string }[]
}

/**
 * Best-effort mapping from the real (thinner) dashboard summary to this
 * view model, for when UI_MOCK_MODE is off — so the redesigned dashboard
 * still renders once a real Supabase project is wired back up, just without
 * the fields the backend doesn't compute yet (uptime, topology, per-company
 * breakdown). Graceful degradation, same spirit as the isXConfigured() guard
 * pattern used for external integrations elsewhere in this app.
 */
export function mapRealSummaryToViewModel(summary: RealDashboardSummary): MockDashboardData {
  const activityValues = summary.activity.map((a) => a.value)
  const latest = activityValues[activityValues.length - 1] ?? 0

  return {
    kpis: {
      devices: { label: "Devices", value: summary.deviceCount, delta: 0, history: activityValues.length ? activityValues : [summary.deviceCount], status: "online" },
      openAlerts: {
        label: "Open alerts",
        value: summary.openAlertCount,
        delta: 0,
        history: [summary.openAlertCount],
        status: summary.openAlertCount > 0 ? "warning" : "online",
      },
      uptime: { label: "Fleet uptime", value: 100, unit: "%", delta: 0, history: [100], status: "online" },
      telemetryRate: { label: "Telemetry rate", value: latest, unit: "/hr", delta: 0, history: activityValues.length ? activityValues : [latest], status: "online" },
    },
    statusBreakdown: [
      { label: "Devices", value: Math.max(0, summary.deviceCount - summary.openAlertCount), color: "var(--status-online)" },
      { label: "Alerting", value: summary.openAlertCount, color: "var(--status-warning)" },
    ],
    telemetry: summary.activity,
    byCompany: [],
    sites: [{ id: "fleet", label: "Fleet", deviceCount: summary.deviceCount, onlinePct: 100, status: "online" }],
    deviceTypes: [],
    feed: summary.recentAlerts.map((a) => ({
      id: String(a.id),
      severity: "warning" as const,
      title: a.deviceName ?? "Device",
      detail: a.message,
      source: "",
      minutesAgo: Math.max(0, Math.round((Date.now() - new Date(a.createdAt).getTime()) / 60000)),
    })),
  }
}

/**
 * Deterministic PRNG (mulberry32) so mock data renders the same every
 * reload instead of jittering — shared by every `lib/mock/*` module, not
 * just the dashboard.
 */
export function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * A mean-reverting random walk, not a periodic wave — real telemetry/business
 * metrics don't oscillate on a clean sine curve, they wander with noise
 * around a slowly drifting trend. Deterministic per seed (mulberry32), so it
 * still renders identically on every reload.
 */
export function series(n: number, base: number, amplitude: number, seed: number): number[] {
  const rand = mulberry32(seed)
  const out: number[] = []
  // A gentle overall drift (some metrics trend up over the window, some down) —
  // fixed per seed, not random noise added at each step.
  const drift = (rand() - 0.5) * amplitude * 1.2
  let value = base + (rand() - 0.5) * amplitude * 0.3
  for (let i = 0; i < n; i++) {
    const target = base + drift * (i / Math.max(1, n - 1))
    const pull = (target - value) * 0.3
    const step = (rand() - 0.5) * amplitude * 0.55
    value = value + pull + step
    out.push(Math.max(0, Math.round(value)))
  }
  return out
}

const COMPANIES = ["Harborline Marinas", "Northstar Facilities", "BlueWater Group", "Summit Property Co.", "Coastal Ops"]

export function getMockDashboardData(): MockDashboardData {
  const telemetryHistory = series(24, 420, 160, 7)
  const alertHistory = series(14, 4, 3, 42)
  const uptimeHistory = [99.6, 99.7, 99.9, 99.8, 99.9, 99.95, 99.82]
  const deviceHistory = series(14, 60, 4, 11)

  return {
    kpis: {
      devices: { label: "Devices", value: 63, delta: 4.8, history: deviceHistory, status: "online" },
      openAlerts: { label: "Open alerts", value: 3, delta: -25, history: alertHistory, status: "warning" },
      uptime: { label: "Fleet uptime", value: 99.82, unit: "%", delta: 0.12, history: uptimeHistory, status: "online" },
      telemetryRate: {
        label: "Telemetry rate",
        value: telemetryHistory[telemetryHistory.length - 1],
        unit: "/hr",
        delta: 8.3,
        history: telemetryHistory,
        status: "online",
      },
    },
    statusBreakdown: [
      { label: "Online", value: 57, color: "var(--status-online)" },
      { label: "Warning", value: 4, color: "var(--status-warning)" },
      { label: "Offline", value: 2, color: "var(--status-critical)" },
    ],
    telemetry: telemetryHistory.map((value, i) => ({ label: `${String(i).padStart(2, "0")}:00`, value })),
    byCompany: COMPANIES.map((label, i) => ({ label, value: [18, 14, 12, 11, 8][i] })),
    sites: [
      { id: "harborline", label: "Harborline Marinas", deviceCount: 18, onlinePct: 96, status: "online" },
      { id: "northstar", label: "Northstar Facilities", deviceCount: 14, onlinePct: 82, status: "warning" },
      { id: "bluewater", label: "BlueWater Group", deviceCount: 12, onlinePct: 97, status: "online" },
      { id: "summit", label: "Summit Property Co.", deviceCount: 11, onlinePct: 58, status: "critical" },
      { id: "coastal", label: "Coastal Ops", deviceCount: 8, onlinePct: 100, status: "online" },
    ],
    deviceTypes: [
      { id: "emax-duplex", label: "eMAX Duplex", deviceCount: 16, onlinePct: 94, status: "online" },
      { id: "max-switch", label: "MAX Switch", deviceCount: 12, onlinePct: 100, status: "online" },
      { id: "bilgemax", label: "Bilgemax Monitoring Kit", deviceCount: 14, onlinePct: 79, status: "warning" },
      { id: "charge-controller", label: "Command Charge Controller", deviceCount: 11, onlinePct: 91, status: "online" },
      { id: "sensor-node", label: "Sensor Node", deviceCount: 10, onlinePct: 60, status: "critical" },
    ],
    feed: [
      { id: "1", severity: "critical", title: "Device offline", detail: "eMAX Duplex #42 stopped reporting", source: "Summit Property Co.", minutesAgo: 3 },
      { id: "2", severity: "warning", title: "Battery low", detail: "Sensor #08 at 14% charge", source: "Northstar Facilities", minutesAgo: 11 },
      { id: "3", severity: "info", title: "Firmware updated", detail: "MAX Switch #17 → v2.4.1", source: "Harborline Marinas", minutesAgo: 26 },
      { id: "4", severity: "warning", title: "Signal degraded", detail: "LoRa RSSI dropped below threshold on #29", source: "BlueWater Group", minutesAgo: 42 },
      { id: "5", severity: "info", title: "New device activated", detail: "Bilgemax unit #63 provisioned", source: "Coastal Ops", minutesAgo: 58 },
      { id: "6", severity: "critical", title: "Charging fault", detail: "Shore power fault on slip B-14", source: "Harborline Marinas", minutesAgo: 74 },
    ],
  }
}
