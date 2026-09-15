import { cn } from "cn"
import { StatusLabel, type StatusKind } from "@/components/charts/status-dot"

export interface LeaderboardRow {
  id: string
  label: string
  sublabel?: string
  value: number
  /** 0-100, drives the horizontal bar fill. */
  pct: number
  status?: StatusKind
  statusText?: string
}

/**
 * A ranked horizontal-bar list — ordered by value, rank badge, thin fill
 * bar behind the label. A different shape than NetworkMap's card grid or a
 * vertical BarChart, for pages that need a third look.
 */
export function Leaderboard({ rows, valueLabel = "" }: { rows: LeaderboardRow[]; valueLabel?: string }) {
  const sorted = [...rows].sort((a, b) => b.value - a.value)
  return (
    <div className="grid gap-1">
      {sorted.map((r, i) => (
        <div key={r.id} className="relative flex items-center gap-3 overflow-hidden rounded-md py-2 pr-3 pl-1">
          <div
            className="bg-accent absolute inset-y-0 left-0 rounded-md"
            style={{ width: `${Math.max(2, r.pct)}%` }}
            aria-hidden="true"
          />
          <span className="text-muted-foreground eyebrow relative w-5 shrink-0 text-center normal-case">{i + 1}</span>
          <div className="relative min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{r.label}</p>
            {r.sublabel ? <p className="text-muted-foreground truncate text-xs">{r.sublabel}</p> : null}
          </div>
          <span className={cn("relative font-mono text-sm font-semibold tabular-nums")}>
            {r.value}
            {valueLabel}
          </span>
          {r.status ? <StatusLabel status={r.status}>{r.statusText ?? r.status}</StatusLabel> : null}
        </div>
      ))}
    </div>
  )
}
