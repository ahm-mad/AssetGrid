/** Circular progress ring (e.g. uptime %) — flat, no glow (ADR-UX005). */
export function RadialGauge({
  value,
  max = 100,
  size = 120,
  stroke = 10,
  color = "var(--status-online)",
  label,
}: {
  value: number
  max?: number
  size?: number
  stroke?: number
  color?: string
  label?: string
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(1, value / max))
  const offset = c * (1 - pct)

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-1">
        <span
          className="font-mono leading-none font-semibold tabular-nums"
          style={{ color, fontSize: Math.max(11, size * 0.22) }}
        >
          {value.toFixed(value % 1 === 0 ? 0 : size < 90 ? 1 : 2)}
        </span>
        {label ? <span className="text-muted-foreground mt-1 text-[10px] tracking-wide uppercase">{label}</span> : null}
      </div>
    </div>
  )
}
