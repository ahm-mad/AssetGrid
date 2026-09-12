import { Card, CardContent } from "@/components/ui/card"
import { cn } from "cn"

function compact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export function StatTile({
  label,
  value,
  status,
}: {
  label: string
  value: number
  /** Optional status tint for the value — reserved colors, never a categorical hue. */
  status?: "good" | "warning" | "critical"
}) {
  const statusClass =
    status === "critical"
      ? "text-[#d03b3b] dark:text-[#e66767]"
      : status === "warning"
        ? "text-[#a66a00] dark:text-[#fab219]"
        : undefined

  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-muted-foreground text-sm">{label}</p>
        <p className={cn("text-2xl font-semibold tabular-nums", statusClass)}>{compact(value)}</p>
      </CardContent>
    </Card>
  )
}
