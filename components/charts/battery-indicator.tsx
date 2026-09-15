import { BatteryWarning } from "lucide-react"

import { cn } from "cn"

function tone(pct: number) {
  if (pct <= 20) return "bg-status-critical"
  if (pct <= 45) return "bg-status-warning"
  return "bg-status-online"
}

/** Small horizontal battery bar — used in device tables/detail views. */
export function BatteryIndicator({ percent }: { percent: number | null }) {
  if (percent == null) {
    return (
      <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
        <BatteryWarning className="size-3.5" />
        No data
      </span>
    )
  }
  return (
    <div className="flex items-center gap-2">
      <div className="bg-muted h-1.5 w-14 overflow-hidden rounded-full">
        <div className={cn("h-full rounded-full", tone(percent))} style={{ width: `${percent}%` }} />
      </div>
      <span className="font-mono text-xs tabular-nums">{percent}%</span>
    </div>
  )
}
