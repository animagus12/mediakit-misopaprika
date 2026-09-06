import { STAT_TOKEN_NAMES } from "@/lib/links";

/**
 * One explanation of the live-stat placeholders, shared by every field that
 * accepts them, so the copy can't drift between the profile line and a card.
 */
export function StatTokenHint() {
  return (
    <p className="text-muted-foreground text-xs">
      Type {STAT_TOKEN_NAMES.join(" or ")} to drop in the live figure, refreshed daily — e.g.{" "}
      <span className="font-mono">MisoPaprika · {"{youtube_subscribers}"}</span> renders as
      “MisoPaprika · 2.4K subscribers”. If the figure is unavailable the placeholder is dropped
      along with its separator, so the rest of the line still reads properly.
    </p>
  );
}
