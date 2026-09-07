import type { PostState } from "@/lib/contentCalendar";

// globals.css has no success/warning/info token, so the meaning-carrying
// colours here follow the destructive variant's shape: a raw palette hue at
// low opacity, the same convention ActivityRow and PaymentsDueCard use.
//
// The four states are deliberately distinguishable at a glance in a grid
// where most cells are a few pixels of colour: red is a post that was missed,
// amber is one landing this week, green is one already out, and everything
// further off stays muted so it doesn't compete with the two that need doing.
export interface PostTone {
  /** Filled pill, for a brand deal in the month grid. */
  pill: string;
  /**
   * Outlined pill, for the creator's own entries.
   *
   * Colour is already spoken for: it carries the state, which is the more
   * urgent axis. Fill against outline is the second channel, so "is this paid
   * work or mine" reads at a glance without competing with "is it late".
   */
  pillOwn: string;
  /** Bare dot, for the grid at phone widths where a pill can't be read. */
  dot: string;
  /**
   * Hollow dot, the phone-width counterpart of pillOwn.
   *
   * Spelled out rather than derived from `dot` at runtime: Tailwind compiles
   * the class names it can find in the source, so a string built by replacing
   * "bg-" with "ring-" names a rule that was never generated and renders as
   * nothing at all.
   */
  dotOwn: string;
  /** Text only, for the label in a list row. */
  text: string;
}

export const POST_TONES: Record<PostState, PostTone> = {
  posted: {
    pill: "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
    pillOwn: "ring-1 ring-inset ring-emerald-500/40 text-emerald-700 dark:text-emerald-400",
    dot: "bg-emerald-500",
    dotOwn: "ring-1 ring-inset ring-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  overdue: {
    pill: "bg-rose-500/10 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400",
    pillOwn: "ring-1 ring-inset ring-rose-500/40 text-rose-600 dark:text-rose-400",
    dot: "bg-rose-500",
    dotOwn: "ring-1 ring-inset ring-rose-500",
    text: "text-rose-600 dark:text-rose-400",
  },
  due: {
    pill: "bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
    pillOwn: "ring-1 ring-inset ring-amber-500/40 text-amber-700 dark:text-amber-400",
    dot: "bg-amber-500",
    dotOwn: "ring-1 ring-inset ring-amber-500",
    text: "text-amber-600 dark:text-amber-400",
  },
  upcoming: {
    pill: "bg-muted text-muted-foreground",
    pillOwn: "ring-1 ring-inset ring-border text-muted-foreground",
    dot: "bg-muted-foreground/50",
    dotOwn: "ring-1 ring-inset ring-muted-foreground/50",
    text: "text-muted-foreground",
  },
};
