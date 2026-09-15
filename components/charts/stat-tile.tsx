import { ArrowDownRight, ArrowUpRight } from "lucide-react"

import { cn } from "cn"
import { Sparkline } from "@/components/charts/sparkline"
import type { StatusKind } from "@/components/charts/status-dot"

function compact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

const ACCENT: Record<StatusKind, string> = {
  online: "var(--status-online)",
  warning: "var(--status-warning)",
  critical: "var(--status-critical)",
  offline: "var(--muted-foreground)",
  info: "var(--foreground)",
}

const BORDER_TINT: Record<StatusKind, string> = {
  critical: "border-status-critical/35",
  warning: "",
  online: "",
  offline: "",
  info: "",
}

export function StatTile({
  label,
  value,
  unit,
  delta,
  history,
  status = "info",
}: {
  label: string
  value: number
  unit?: string
  /** Percent change vs. the prior period; sign determines the arrow/color. */
  delta?: number
  /** Recent history for the inline sparkline. */
  history?: number[]
  status?: StatusKind
}) {
  const positive = (delta ?? 0) >= 0
  return (
    <div className={cn("rounded-lg border bg-card p-4", BORDER_TINT[status])}>
      <div className="flex items-start justify-between gap-2">
        <p className="eyebrow">{label}</p>
      </div>

      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="font-mono text-[25px] leading-none font-semibold tracking-tight tabular-nums" style={{ color: ACCENT[status] }}>
          {compact(value)}
          {unit ? <span className="text-muted-foreground ml-1 text-sm font-normal">{unit}</span> : null}
        </p>
        {history && history.length > 1 ? <Sparkline data={history} color={ACCENT[status]} /> : null}
      </div>

      {typeof delta === "number" ? (
        <div
          className={cn(
            "eyebrow mt-2.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-semibold normal-case",
            positive ? "text-status-online" : "text-status-critical",
          )}
          style={{
            backgroundColor: `color-mix(in oklch, ${positive ? "var(--status-online)" : "var(--status-critical)"} 12%, transparent)`,
          }}
        >
          {positive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
          {Math.abs(delta).toFixed(1)}%
        </div>
      ) : null}
    </div>
  )
}
