"use client"

import { useId } from "react"

/**
 * Tiny decorative trend line for inside a stat tile — no axes, no
 * interaction, just shape. Not a substitute for the full LineChart.
 */
export function Sparkline({
  data,
  width = 96,
  height = 32,
  color = "var(--chart-1)",
}: {
  data: number[]
  width?: number
  height?: number
  color?: string
}) {
  const gid = useId()
  if (data.length < 2) return null

  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const pad = 3

  const points = data.map((v, i) => ({
    x: (i / (data.length - 1)) * width,
    y: pad + (1 - (v - min) / range) * (height - pad * 2),
  }))

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")
  const area = `${line} L${points[points.length - 1].x},${height} L0,${height} Z`

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} stroke="none" />
      <path d={line} fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r={2.25} fill={color} />
    </svg>
  )
}
