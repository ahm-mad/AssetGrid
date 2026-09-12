"use client"

import { useMemo, useRef, useState } from "react"

export interface LinePoint {
  label: string
  value: number
}

/**
 * Single-series trend-over-time chart (area + line), sequential blue,
 * with a crosshair that snaps to the nearest point per the dataviz skill.
 */
export function LineChart({
  data,
  unit = "",
  height = 220,
  color = "var(--chart-1)",
}: {
  data: LinePoint[]
  /** Appended after the number in the tooltip, e.g. " packets". */
  unit?: string
  height?: number
  color?: string
}) {
  const formatValue = (n: number) => `${n.toLocaleString()}${unit}`
  const [hover, setHover] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)

  const width = 640
  const padLeft = 40
  const padBottom = 24
  const padTop = 16
  const padRight = 12
  const plotW = width - padLeft - padRight
  const plotH = height - padTop - padBottom

  const max = Math.max(1, ...data.map((d) => d.value))
  const niceMax = Math.ceil(max / 5) * 5 || 1
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(niceMax * f))

  const points = useMemo(
    () =>
      data.map((d, i) => ({
        x: padLeft + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW),
        y: padTop + plotH - (d.value / niceMax) * plotH,
        ...d,
      })),
    [data, niceMax, plotW, plotH]
  )

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ")
  const areaPath = `${linePath} L${points[points.length - 1]?.x ?? 0},${padTop + plotH} L${points[0]?.x ?? 0},${padTop + plotH} Z`

  function handleMove(e: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * width
    let nearest = 0
    let best = Infinity
    points.forEach((p, i) => {
      const d = Math.abs(p.x - px)
      if (d < best) {
        best = d
        nearest = i
      }
    })
    setHover(nearest)
  }

  return (
    <div className="relative" style={{ width: "100%", maxWidth: width }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Line chart"
        className="w-full overflow-visible"
        onPointerMove={handleMove}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((t) => {
          const y = padTop + plotH - (t / niceMax) * plotH
          return (
            <g key={t}>
              <line x1={padLeft} x2={width - padRight} y1={y} y2={y} stroke="var(--border)" strokeWidth={1} />
              <text x={padLeft - 8} y={y} textAnchor="end" dominantBaseline="middle" className="fill-muted-foreground text-[10px]">
                {t.toLocaleString()}
              </text>
            </g>
          )
        })}

        <path d={areaPath} fill={color} opacity={0.1} stroke="none" />
        <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {hover != null ? (
          <>
            <line
              x1={points[hover].x}
              x2={points[hover].x}
              y1={padTop}
              y2={padTop + plotH}
              stroke="var(--muted-foreground)"
              strokeWidth={1}
            />
            <circle cx={points[hover].x} cy={points[hover].y} r={4} fill={color} stroke="var(--background)" strokeWidth={2} />
          </>
        ) : null}

        {/* end marker, always shown */}
        {points.length > 0 ? (
          <circle
            cx={points[points.length - 1].x}
            cy={points[points.length - 1].y}
            r={4}
            fill={color}
            stroke="var(--background)"
            strokeWidth={2}
          />
        ) : null}

        {points
          .filter((_, i) => i === 0 || i === points.length - 1 || i === Math.floor(points.length / 2))
          .map((p) => (
            <text key={p.label} x={p.x} y={height - padBottom + 16} textAnchor="middle" className="fill-muted-foreground text-[10px]">
              {p.label}
            </text>
          ))}
      </svg>

      {hover != null ? (
        <div
          className="bg-popover text-popover-foreground pointer-events-none absolute rounded-md border px-2.5 py-1.5 text-xs shadow-md"
          style={{
            left: `${(points[hover].x / width) * 100}%`,
            top: 0,
            transform: "translate(-50%, -110%)",
          }}
        >
          <div className="text-muted-foreground">{points[hover].label}</div>
          <div className="font-semibold">{formatValue(points[hover].value)}</div>
        </div>
      ) : null}
    </div>
  )
}
