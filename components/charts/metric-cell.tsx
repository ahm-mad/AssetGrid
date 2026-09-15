import { cn } from "cn"

/** A small bordered metric cell — eyebrow label + big mono value — for detail-drawer-style grids. */
export function MetricCell({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={cn("bg-muted rounded-md border p-3", className)}>
      <p className="eyebrow">{label}</p>
      <p className="mt-1.5 font-mono text-lg font-semibold tabular-nums">{value}</p>
    </div>
  )
}
