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
 * Font: `font-brand` resolves to `--font-brand` (`"Corpta", var(--font-sans)`)
 * — see the `@font-face` + `--font-brand` comments in `app/globals.css` for
 * why Corpta is loaded that way (local-machine-only file, gitignored).
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
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className={cn("text-primary size-6 shrink-0", markClassName)} />
      <span className={cn("font-brand text-lg font-semibold tracking-wider uppercase", textClassName)}>
        <span className="text-foreground">Asset</span> <span className="text-primary">Grid</span>
      </span>
    </span>
  );
}
