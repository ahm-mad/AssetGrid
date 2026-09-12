import 'server-only'

import { createClient } from '@/utils/supabase/server'

export interface DashboardSummary {
  deviceCount: number
  openAlertCount: number
  buildingCount: number
  marinaCount: number
  customerCount: number
  /** Hourly packet-volume trend over the most recent loaded telemetry window. */
  activity: { label: string; value: number }[]
  recentAlerts: { id: number; deviceName: string | null; message: string; createdAt: string }[]
}

/**
 * Dashboard KPI tiles + activity trend. Every count is RLS-scoped (same
 * pattern as the rest of the app — no manual role branching, ADR-013).
 * The activity series buckets `telemetry`'s most recent window (the ETL
 * currently loads ~6h of raw packets, ADR-039) into hourly counts, so it
 * reflects real packet volume without exposing any individual device or
 * owner identity — pure aggregate counts.
 */
/**
 * Telemetry is dense (tens of packets/minute) and PostgREST caps row
 * fetches at 1000 (`db-max-rows`), so pulling raw rows to bucket in JS only
 * covers minutes, not hours. Instead: find the loaded window's bounds, then
 * run one `count`-only (head request, no rows transferred) query per hour —
 * cheap, and each stays under RLS same as any other query.
 */
async function getHourlyTelemetryActivity(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<{ label: string; value: number }[]> {
  const [{ data: oldest }, { data: newest }] = await Promise.all([
    supabase.from('telemetry').select('created_at').order('created_at', { ascending: true }).limit(1),
    supabase.from('telemetry').select('created_at').order('created_at', { ascending: false }).limit(1),
  ])
  if (!oldest?.[0] || !newest?.[0]) return []

  const start = new Date(oldest[0].created_at as string)
  start.setUTCMinutes(0, 0, 0)
  const end = new Date(newest[0].created_at as string)

  const hours: Date[] = []
  for (let h = new Date(start); h <= end && hours.length < 48; h = new Date(h.getTime() + 3_600_000)) {
    hours.push(h)
  }

  const counts = await Promise.all(
    hours.map((h) => {
      const next = new Date(h.getTime() + 3_600_000)
      return supabase
        .from('telemetry')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', h.toISOString())
        .lt('created_at', next.toISOString())
    })
  )

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return hours.map((h, i) => ({
    label: `${dayNames[h.getUTCDay()]} ${String(h.getUTCHours()).padStart(2, '0')}:00`,
    value: counts[i].count ?? 0,
  }))
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const supabase = await createClient()

  const [devices, alerts, buildings, marinas, customers, activity, alertLog] = await Promise.all([
    supabase.from('inventory_devices').select('id', { count: 'exact', head: true }),
    supabase.from('alert_state').select('id', { count: 'exact', head: true }).eq('is_alert', true),
    supabase.from('buildings').select('id', { count: 'exact', head: true }),
    supabase.from('marinas').select('id', { count: 'exact', head: true }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    getHourlyTelemetryActivity(supabase),
    supabase
      .from('alert_log')
      .select('id, device_name, message, created_at')
      .order('created_at', { ascending: false })
      .limit(8),
  ])

  return {
    deviceCount: devices.count ?? 0,
    openAlertCount: alerts.count ?? 0,
    buildingCount: buildings.count ?? 0,
    marinaCount: marinas.count ?? 0,
    customerCount: customers.count ?? 0,
    activity,
    recentAlerts: (alertLog.data ?? []).map((a) => ({
      id: a.id,
      deviceName: a.device_name,
      message: a.message,
      createdAt: a.created_at,
    })),
  }
}
