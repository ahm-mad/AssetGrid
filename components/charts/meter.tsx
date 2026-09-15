import { cn } from "cn"

const FILL: Record<"good" | "warn" | "info", string> = {
  good: "bg-status-online",
  warn: "bg-status-warning",
  info: "bg-primary",
}

/** Label + value line above a track/fill progress bar — resource/charge meters. */
export function Meter({
  label,
  value,
  max = 100,
  valueLabel,
  tone = "info",
}: {
  label: string
  value: number
  max?: number
  valueLabel?: string
  tone?: "good" | "warn" | "info"
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono text-xs tabular-nums">{valueLabel ?? `${Math.round(pct)}%`}</span>
      </div>
      <div className="bg-muted h-1.5 overflow-hidden rounded-full">
        <div className={cn("h-full rounded-full transition-all", FILL[tone])} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
