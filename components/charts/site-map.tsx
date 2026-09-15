import { StatusDot, type StatusKind } from "@/components/charts/status-dot"

export interface SiteMarker {
  id: string
  label: string
  sublabel?: string
  lat: number
  lng: number
  deviceCount: number
  status: StatusKind
}

// Continental US bounding box — this dataset is US-only; extend if that changes.
const LAT_MIN = 24
const LAT_MAX = 49
const LNG_MIN = -125
const LNG_MAX = -66

/**
 * An honest lat/lng scatter (no basemap outline — real coordinates,
 * normalized into the panel, not a stylized illustration) over a faint
 * blueprint grid. Shows where sites actually are, not just their aggregate
 * health (that's what NetworkMap's card grids are for).
 */
export function SiteMap({ markers, height = 260 }: { markers: SiteMarker[]; height?: number }) {
  return (
    <div className="bg-grid-map relative overflow-hidden rounded-lg border" style={{ height }}>
      {markers.map((m) => {
        const x = ((m.lng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * 100
        const y = (1 - (m.lat - LAT_MIN) / (LAT_MAX - LAT_MIN)) * 100
        return (
          <div
            key={m.id}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5"
            style={{ left: `${Math.min(97, Math.max(3, x))}%`, top: `${Math.min(92, Math.max(8, y))}%` }}
          >
            <StatusDot status={m.status} />
            <div className="bg-card rounded-md border px-2 py-1 text-center shadow-sm">
              <p className="text-xs font-semibold whitespace-nowrap">{m.label}</p>
              {m.sublabel ? <p className="text-muted-foreground text-[10px] whitespace-nowrap">{m.sublabel}</p> : null}
              <p className="font-mono text-[10px] tabular-nums">{m.deviceCount} devices</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
