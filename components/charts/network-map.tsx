import { Building2, type LucideIcon } from "lucide-react"

import { cn } from "cn"
import { StatusLabel, type StatusKind } from "@/components/charts/status-dot"

export interface FleetGroup {
  id: string
  label: string
  deviceCount: number
  /** Share of this group's devices currently online, 0-100 — drives the two-segment bar. */
  onlinePct: number
  status: StatusKind
}

const STATUS_TEXT: Record<StatusKind, string> = {
  online: "Nominal",
  warning: "Attention",
  critical: "Critical",
  offline: "Offline",
  info: "—",
}

/**
 * A flat bordered card per fleet group — site, device type, whatever the
 * caller groups by (icon, name, a simple two-segment online/offline bar,
 * count + status pill). Not a literal map or a node-graph with connecting
 * lines (ADR-UX003, ADR-UX005). Modeled on the reference system's
 * "Product Estate" grid.
 */
export function NetworkMap({ nodes, icon: Icon = Building2 }: { nodes: FleetGroup[]; icon?: LucideIcon }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {nodes.map((n) => (
        <div key={n.id} className={cn("rounded-lg border bg-card p-4", n.status === "critical" && "border-status-critical/35")}>
          <div className="flex items-center gap-3">
            <div className="bg-accent text-accent-foreground flex size-9 shrink-0 items-center justify-center rounded-md">
              <Icon className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{n.label}</p>
            </div>
          </div>

          <div className="bg-muted mt-3.5 flex h-1.5 gap-px overflow-hidden rounded-full">
            <span className="bg-status-online h-full" style={{ flex: n.onlinePct }} />
            <span className="bg-status-offline/40 h-full" style={{ flex: Math.max(0.5, 100 - n.onlinePct) }} />
          </div>

          <div className="mt-2.5 flex items-center justify-between">
            <p className="text-muted-foreground text-xs">
              <span className="text-foreground font-mono font-semibold">{n.deviceCount}</span> devices · {n.onlinePct}% up
            </p>
            <StatusLabel status={n.status}>{STATUS_TEXT[n.status]}</StatusLabel>
          </div>
        </div>
      ))}
    </div>
  )
}
