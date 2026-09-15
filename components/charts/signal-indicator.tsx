import { cn } from "cn"

/** Signal-strength bars from a dBm reading — used in device tables/detail views. */
export function SignalIndicator({ dbm }: { dbm: number | null }) {
  if (dbm == null) {
    return <span className="text-muted-foreground text-xs">No signal</span>
  }
  const bars = dbm > -70 ? 4 : dbm > -85 ? 3 : dbm > -100 ? 2 : 1
  const color = bars >= 3 ? "bg-status-online" : bars === 2 ? "bg-status-warning" : "bg-status-critical"

  return (
    <div className="flex items-end gap-0.5" title={`${dbm} dBm`}>
      {[1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className={cn("w-1 rounded-sm", i <= bars ? color : "bg-muted")}
          style={{ height: `${4 + i * 2.5}px` }}
        />
      ))}
    </div>
  )
}
