import { cn } from "cn";

/**
 * The AssetGrid mark — a 2×2 grid glyph (solid + soft tiles, tying it to
 * the two-tone wordmark next to it). Single-color via `currentColor` so it
 * can be dropped on any background by setting a text color on a parent.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <rect x="1.5" y="1.5" width="7.5" height="7.5" rx="1.5" fill="currentColor" />
      <rect x="11" y="1.5" width="7.5" height="7.5" rx="1.5" fill="currentColor" opacity="0.45" />
      <rect x="1.5" y="11" width="7.5" height="7.5" rx="1.5" fill="currentColor" opacity="0.45" />
      <rect x="11" y="11" width="7.5" height="7.5" rx="1.5" fill="currentColor" />
    </svg>
  );
}

/**
 * The AssetGrid wordmark: mark + two-tone "Asset" / "Grid" text. One
 * component so the sidebar, the login page, and the landing page (once
 * built) all render literally the same logo instead of three near-copies.
 *
 * Font: `font-brand` resolves to `--font-brand`, which currently falls
 * back to the app's sans stack (see `--font-brand` in `app/globals.css`'s
 * `@theme inline` block). Once a licensed Corpta font file exists, load it
 * with `next/font/local` in `app/layout.tsx` and point that file's CSS
 * variable at `--font-brand` in `:root` — every usage of <Logo> picks it
 * up automatically, no call-site changes needed.
 */
export function Logo({
  className,
  markClassName,
  textClassName,
}: {
  className?: string;
  markClassName?: string;
  textClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className={cn("text-primary size-5 shrink-0", markClassName)} />
      <span className={cn("font-brand text-sm font-semibold tracking-wide uppercase", textClassName)}>
        <span className="text-foreground">Asset</span>
        <span className="text-primary">Grid</span>
      </span>
    </span>
  );
}
