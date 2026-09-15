import { cn } from "cn"

export type SlipStatus = "vacant" | "online" | "warning" | "critical"

export interface FacilitySlip {
  id: number
  label: string
  status: SlipStatus
  boatName?: string
}

export interface FacilityDock {
  id: number
  name: string
  slips: FacilitySlip[]
}

const CELL_COLOR: Record<SlipStatus, string> = {
  vacant: "bg-muted border-border",
  online: "bg-status-online/25 border-status-online text-status-online",
  warning: "bg-status-warning/25 border-status-warning text-status-warning",
  critical: "bg-status-critical/25 border-status-critical text-status-critical",
}

const LEGEND: { status: SlipStatus; label: string }[] = [
  { status: "online", label: "Occupied · reporting" },
  { status: "warning", label: "Occupied · no device" },
  { status: "critical", label: "Occupied · alert" },
  { status: "vacant", label: "Vacant" },
]

/**
 * A literal physical layout — docks as lanes, slips as cells — instead of an
 * abstract card grid. This is the one place in the app that shows where
 * assets actually sit, not just their aggregate health.
 */
export function FacilityMap({ docks }: { docks: FacilityDock[] }) {
  return (
    <div className="grid gap-4">
      <div className="bg-grid-map grid gap-5 rounded-lg border p-4">
        {docks.map((dock) => (
          <div key={dock.id}>
            <p className="eyebrow mb-2">{dock.name}</p>
            <div className="flex flex-wrap gap-2">
              {dock.slips.map((slip) => (
                <div
                  key={slip.id}
                  title={slip.boatName ? `${slip.label} — ${slip.boatName}` : `${slip.label} — vacant`}
                  className={cn(
                    "flex size-14 flex-col items-center justify-center rounded-md border text-center transition-transform hover:-translate-y-0.5",
                    CELL_COLOR[slip.status],
                  )}
                >
                  <span className="text-[10px] font-semibold">{slip.label}</span>
                  {slip.boatName ? (
                    <span className="max-w-13 truncate px-0.5 text-[9px] opacity-80">{slip.boatName}</span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-4">
        {LEGEND.map((l) => (
          <span key={l.status} className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
            <span className={cn("size-2.5 rounded-sm border", CELL_COLOR[l.status])} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  )
}
