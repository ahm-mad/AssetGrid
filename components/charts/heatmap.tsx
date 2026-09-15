import { Fragment } from "react"

/**
 * A calendar/activity-style heatmap — rows × cols grid of intensity cells.
 * A different shape again (density via color, not position or bar length)
 * for a page that needs yet another visual signature.
 */
export function Heatmap({
  rowLabels,
  colLabels,
  data,
  color = "var(--chart-1)",
  formatValue = (n: number) => String(n),
}: {
  rowLabels: string[]
  colLabels: string[]
  /** rowLabels.length × colLabels.length matrix. */
  data: number[][]
  color?: string
  formatValue?: (n: number) => string
}) {
  const max = Math.max(1, ...data.flat())

  return (
    <div className="overflow-x-auto">
      <div className="inline-grid gap-1" style={{ gridTemplateColumns: `auto repeat(${colLabels.length}, minmax(0, 1fr))` }}>
        <span />
        {colLabels.map((c) => (
          <span key={c} className="text-muted-foreground pb-1 text-center text-[10px]">
            {c}
          </span>
        ))}
        {rowLabels.map((r, ri) => (
          <Fragment key={r}>
            <span className="text-muted-foreground flex items-center pr-2 text-xs whitespace-nowrap">{r}</span>
            {colLabels.map((c, ci) => {
              const v = data[ri]?.[ci] ?? 0
              const opacity = 0.08 + (v / max) * 0.85
              return (
                <div
                  key={`${r}-${c}`}
                  title={`${r} ${c}: ${formatValue(v)}`}
                  className="aspect-square min-w-4 rounded-sm"
                  style={{ backgroundColor: color, opacity }}
                />
              )
            })}
          </Fragment>
        ))}
      </div>
    </div>
  )
}
