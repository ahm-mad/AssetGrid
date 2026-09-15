import { Fragment } from "react"

// Discrete intensity buckets (not a raw linear opacity ramp) — reads as a
// deliberate, GitHub-contribution-graph-style scale rather than a washed-out
// gradient, and keeps even "empty" cells visible as part of the grid.
const BUCKET_MIX = [10, 30, 55, 78, 100]

function bucketFor(v: number, max: number) {
  if (v <= 0) return 0
  const ratio = v / max
  if (ratio < 0.2) return 1
  if (ratio < 0.45) return 2
  if (ratio < 0.7) return 3
  return 4
}

/**
 * A calendar/activity-style heatmap — rows × cols grid of intensity cells.
 * A different shape again (density via color, not position or bar length)
 * for a page that needs yet another visual signature. Full-width (stretches
 * to fill its card, doesn't just size to its cells) with a quantized color
 * scale and a small legend, GitHub-contribution-graph style.
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
    <div className="grid gap-3">
      <div className="overflow-x-auto">
        <div
          className="grid w-full gap-1"
          style={{ gridTemplateColumns: `auto repeat(${colLabels.length}, minmax(0, 1fr))` }}
        >
          <span />
          {colLabels.map((c, ci) => (
            <span key={ci} className="eyebrow pb-1 text-center !text-[9px]">
              {c}
            </span>
          ))}
          {rowLabels.map((r, ri) => (
            <Fragment key={r}>
              <span className="eyebrow flex items-center pr-2 whitespace-nowrap">{r}</span>
              {colLabels.map((c, ci) => {
                const v = data[ri]?.[ci] ?? 0
                const pct = BUCKET_MIX[bucketFor(v, max)]
                return (
                  <div
                    key={ci}
                    title={`${r} ${c || ci}: ${formatValue(v)}`}
                    className="aspect-square min-w-3 rounded-[3px] transition-transform hover:scale-110"
                    style={{ backgroundColor: `color-mix(in oklch, ${color} ${pct}%, var(--muted))` }}
                  />
                )
              })}
            </Fragment>
          ))}
        </div>
      </div>

      <div className="text-muted-foreground flex items-center justify-end gap-1.5 text-xs">
        <span className="eyebrow">Less</span>
        {BUCKET_MIX.map((pct) => (
          <div
            key={pct}
            className="size-3 rounded-[3px]"
            style={{ backgroundColor: `color-mix(in oklch, ${color} ${pct}%, var(--muted))` }}
          />
        ))}
        <span className="eyebrow">More</span>
      </div>
    </div>
  )
}
