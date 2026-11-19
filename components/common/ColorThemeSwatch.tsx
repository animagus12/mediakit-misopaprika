import type { ColorTheme } from "@/lib/colorThemes";
import { cn } from "@/lib/utils";

/**
 * A dot that wears one theme whatever the page wears: its background half and
 * its primary half, drawn from that theme's own tokens in the current light
 * or dark mode, so the preview can never drift from the real colours.
 */
export function ColorThemeSwatch({ theme, className }: { theme: ColorTheme; className?: string }) {
  return (
    <span
      data-color-theme={theme}
      aria-hidden
      className={cn(
        "relative size-3.5 shrink-0 overflow-hidden rounded-full bg-background ring-1 ring-foreground/20",
        className,
      )}
    >
      <span className="absolute inset-y-0 right-0 w-1/2 bg-primary" />
    </span>
  );
}
