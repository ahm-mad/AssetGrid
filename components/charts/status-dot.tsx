import { cn } from "cn"

export type StatusKind = "online" | "warning" | "critical" | "offline" | "info"

const COLOR_VAR: Record<StatusKind, string> = {
  online: "var(--status-online)",
  warning: "var(--status-warning)",
  critical: "var(--status-critical)",
  offline: "var(--status-offline)",
  info: "var(--status-info)",
}

const DOT_BG: Record<StatusKind, string> = {
  online: "bg-status-online",
  warning: "bg-status-warning",
  critical: "bg-status-critical",
  offline: "bg-status-offline",
  info: "bg-status-info",
}

/**
 * A single live-status blinker (solid dot + expanding ping ring) — reserved
 * for one "live" indicator per screen (e.g. the header chip), per ADR-UX005.
 * Everywhere else, use StatusLabel's soft-tint pill instead.
 */
export function StatusDot({ status, className }: { status: StatusKind; className?: string }) {
  const pulse = status === "online" || status === "critical"
  return (
    <span className={cn("relative inline-flex size-2", className)}>
      {pulse ? (
        <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", DOT_BG[status])} />
      ) : null}
      <span className={cn("relative inline-flex size-2 rounded-full", DOT_BG[status])} />
    </span>
  )
}

/**
 * Soft-tint status pill (solid-color text + a barely-there tinted
 * background, small dot) — the default status treatment everywhere except
 * the one "live" header chip. Flat, no glow (ADR-UX005).
 */
export function StatusLabel({ status, children }: { status: StatusKind; children: React.ReactNode }) {
  const color = COLOR_VAR[status]
  return (
    <span
      className="eyebrow inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold"
      style={{ color, backgroundColor: `color-mix(in oklch, ${color} 14%, transparent)` }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
      {children}
    </span>
  )
}
