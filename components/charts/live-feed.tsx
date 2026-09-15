import { cn } from "cn"
import { StatusLabel } from "@/components/charts/status-dot"

export type FeedSeverity = "critical" | "warning" | "info"

export interface FeedItem {
  id: string
  severity: FeedSeverity
  title: string
  detail: string
  source: string
  minutesAgo: number
}

const SEVERITY_LABEL: Record<FeedSeverity, string> = {
  critical: "Critical",
  warning: "Warning",
  info: "Info",
}

const BAR_COLOR: Record<FeedSeverity, string> = {
  critical: "bg-status-critical",
  warning: "bg-status-warning",
  info: "bg-status-info",
}

function timeAgo(mins: number): string {
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  return `${Math.round(mins / 60)}h ago`
}

export function LiveFeed({ items }: { items: FeedItem[] }) {
  return (
    <ul className="grid">
      {items.map((item) => (
        <li key={item.id} className="hover:bg-muted/60 -mx-2 grid grid-cols-[3px_1fr_auto] items-center gap-3 rounded-md px-2 py-2.5">
          <span className={cn("h-9 self-stretch rounded-full", BAR_COLOR[item.severity])} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <StatusLabel status={item.severity === "info" ? "info" : item.severity}>
                {SEVERITY_LABEL[item.severity]}
              </StatusLabel>
              <span className="truncate text-sm font-medium">{item.title}</span>
            </div>
            <p className="text-muted-foreground mt-0.5 truncate text-xs">
              {item.detail}
              {item.source ? <span className="font-mono"> · {item.source}</span> : null}
            </p>
          </div>
          <time className="text-muted-foreground eyebrow shrink-0 normal-case">{timeAgo(item.minutesAgo)}</time>
        </li>
      ))}
    </ul>
  )
}
