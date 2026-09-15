"use client"

import { useState } from "react"

export interface DonutDatum {
  label: string
  value: number
  color: string
}

/** Categorical donut with a center total and a colored legend — status/fleet breakdowns. */
export function DonutChart({
  data,
  size = 160,
  thickness = 22,
  centerLabel = "Total",
}: {
  data: DonutDatum[]
  size?: number
  thickness?: number
  centerLabel?: string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r

  let cursor = 0
  const segments = data.map((d, i) => {
    const frac = d.value / total
    const dash = frac * c
    const seg = { ...d, offset: cursor, dash, i }
    cursor += dash
    return seg
  })

  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={thickness} />
          {segments.map((s) => (
            <circle
              key={s.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={hover === s.i ? thickness + 3 : thickness}
              strokeDasharray={`${s.dash} ${c - s.dash}`}
              strokeDashoffset={-s.offset}
              style={{ transition: "stroke-width 150ms" }}
              onMouseEnter={() => setHover(s.i)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-2xl font-semibold tabular-nums">
            {hover != null ? segments[hover].value : total}
          </span>
          <span className="text-muted-foreground text-[10px] tracking-wide uppercase">
            {hover != null ? segments[hover].label : centerLabel}
          </span>
        </div>
      </div>

      <ul className="grid gap-2 text-sm">
        {data.map((d, i) => (
          <li
            key={d.label}
            className="flex items-center gap-2"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
            <span className="text-muted-foreground">{d.label}</span>
            <span className="font-mono font-medium tabular-nums">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
