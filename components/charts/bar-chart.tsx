"use client"

import { useId, useState } from "react"

export interface BarDatum {
  label: string
  value: number
}

/** Format kinds instead of a function prop — functions can't cross the server/client boundary. */
export type ChartFormat = "count" | "currency" | "percent"

function formatByKind(n: number, format: ChartFormat): string {
  switch (format) {
    case "currency":
      return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    case "percent":
      return `${n}%`
    default:
      return n.toLocaleString()
  }
}

/**
 * Single-hue column chart (magnitude comparison across a handful of
 * categories) — one series, so no legend box. Mark specs + hover tooltip
 * per the dataviz skill: <=24px columns, 4px rounded caps, hairline
 * gridlines, value-on-cap direct labels, per-bar hover.
 */
export function BarChart({
  data,
  format = "count",
  yMax,
  height = 220,
  color = "var(--chart-1)",
}: {
  data: BarDatum[]
  format?: ChartFormat
  /** Fix the y-axis max (e.g. 100 for a percentage chart); defaults to the data max. */
  yMax?: number
  height?: number
  color?: string
}) {
  const formatValue = (n: number) => formatByKind(n, format)
  const gid = useId()
  const [hover, setHover] = useState<number | null>(null)

  const width = 520
  const padLeft = 40
  const padBottom = 28
  const padTop = 16
  const plotW = width - padLeft - 8
  const plotH = height - padTop - padBottom
  const max = yMax ?? Math.max(1, ...data.map((d) => d.value))
  const niceMax = Math.ceil(max / 5) * 5 || 1

  const barSlot = plotW / data.length
  const barWidth = Math.min(24, barSlot * 0.5)
  const gap = 2
  const maxLabelChars = Math.max(6, Math.min(20, Math.floor(barSlot / 6.2)))
  const truncate = (s: string) => (s.length > maxLabelChars ? s.slice(0, maxLabelChars - 1) + "…" : s)

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(niceMax * f))

  return (
    <div className="relative" style={{ width: "100%", maxWidth: width }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Bar chart"
        className="w-full overflow-visible"
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={`${gid}-bar`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={1} />
            <stop offset="100%" stopColor={color} stopOpacity={0.55} />
          </linearGradient>
        </defs>

        {/* gridlines */}
        {ticks.map((t) => {
          const y = padTop + plotH - (t / niceMax) * plotH
          return (
            <g key={t}>
              <line
                x1={padLeft}
                x2={width - 8}
                y1={y}
                y2={y}
                stroke="var(--border)"
                strokeWidth={1}
                strokeDasharray="3 4"
              />
              <text x={padLeft - 8} y={y} textAnchor="end" dominantBaseline="middle" className="fill-muted-foreground text-[10px]">
                {t.toLocaleString()}
              </text>
            </g>
          )
        })}

        {data.map((d, i) => {
          const x = padLeft + i * barSlot + (barSlot - barWidth) / 2
          const barH = Math.max(0, (d.value / niceMax) * plotH)
          const y = padTop + plotH - barH
          const isHover = hover === i
          return (
            <g key={d.label}>
              {/* hit target: full slot, taller than the bar for easy hover */}
              <rect
                x={padLeft + i * barSlot + gap / 2}
                y={padTop}
                width={barSlot - gap}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                tabIndex={0}
              />
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barH}
                rx={4}
                fill={`url(#${gid}-bar)`}
                opacity={isHover ? 0.8 : 1}
                style={{ pointerEvents: "none" }}
              />
              {barH > 18 ? (
                <text
                  x={x + barWidth / 2}
                  y={y - 6}
                  textAnchor="middle"
                  className="fill-foreground text-[11px] font-medium"
                  style={{ pointerEvents: "none" }}
                >
                  {formatValue(d.value)}
                </text>
              ) : null}
              <text
                x={x + barWidth / 2}
                y={height - padBottom + 16}
                textAnchor="middle"
                className="fill-muted-foreground text-[10px]"
                style={{ pointerEvents: "none" }}
              >
                {truncate(d.label)}
              </text>
            </g>
          )
        })}

        <line x1={padLeft} x2={width - 8} y1={padTop + plotH} y2={padTop + plotH} stroke="var(--muted-foreground)" strokeWidth={1} />
      </svg>

      {hover != null ? (
        <div
          className="bg-popover text-popover-foreground pointer-events-none absolute rounded-md border px-2.5 py-1.5 text-xs shadow-md"
          style={{
            left: `${((hover + 0.5) / data.length) * 100}%`,
            top: 0,
            transform: "translate(-50%, -110%)",
          }}
        >
          <div className="text-muted-foreground">{data[hover].label}</div>
          <div className="font-semibold">{formatValue(data[hover].value)}</div>
        </div>
      ) : null}
      <span id={gid} className="sr-only">
        Bar chart
      </span>
    </div>
  )
}
