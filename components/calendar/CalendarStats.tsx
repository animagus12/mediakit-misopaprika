import Link from "next/link";
import {
  CalendarCheck2,
  CalendarClock,
  CalendarX2,
  Clapperboard,
  type LucideIcon,
} from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WEEK_AHEAD_DAYS, type CalendarSummary } from "@/lib/contentCalendar";
import { cn } from "@/lib/utils";

// Same tone shape BrandsStatCards and EditorTransactionsSection use, so a
// count tile reads the same on every page. A tile only takes its colour when
// its figure asks for something: a zero stays neutral, since "0 missed" in red
// is an alarm about nothing.
const STAT_TONES = {
  neutral: { card: "", value: "", icon: "text-muted-foreground" },
  amber: {
    card: "bg-amber-500/5 ring-amber-500/15",
    value: "text-amber-600 dark:text-amber-400",
    icon: "text-amber-600 dark:text-amber-400",
  },
  rose: {
    card: "bg-rose-500/5 ring-rose-500/15",
    value: "text-rose-600 dark:text-rose-400",
    icon: "text-rose-600 dark:text-rose-400",
  },
  info: {
    card: "bg-sky-500/5 ring-sky-500/15",
    value: "text-sky-600 dark:text-sky-400",
    icon: "text-sky-600 dark:text-sky-400",
  },
  cash: {
    card: "bg-emerald-500/5 ring-emerald-500/15",
    value: "text-emerald-600 dark:text-emerald-400",
    icon: "text-emerald-600 dark:text-emerald-400",
  },
} as const;

interface CalendarStatsProps {
  summary: CalendarSummary;
  /** Where each tile leads: the view or the list that holds the posts it counts. */
  hrefs: { dueSoon: string; missed: string; needsDate: string; posted: string };
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/**
 * The page's four questions, answered before the calendar is read: what is
 * going out soon, what was missed, what has no day, and how the month is
 * going. Each tile links to the place its posts are listed, the way the
 * /brands and /invoices tiles do.
 */
export function CalendarStats({ summary, hrefs }: CalendarStatsProps) {
  const tiles: {
    label: string;
    value: number;
    note: string;
    icon: LucideIcon;
    tone: (typeof STAT_TONES)[keyof typeof STAT_TONES];
    href: string;
  }[] = [
    {
      label: `Next ${WEEK_AHEAD_DAYS} days`,
      value: summary.dueSoon,
      note: summary.notReady > 0 ? `${summary.notReady} not ready yet` : "Everything on track",
      icon: Clapperboard,
      tone: summary.notReady > 0 ? STAT_TONES.amber : STAT_TONES.neutral,
      href: hrefs.dueSoon,
    },
    {
      label: "Missed",
      value: summary.missed,
      note: summary.missed > 0 ? "Past their day, not posted" : "Nothing slipped",
      icon: CalendarX2,
      tone: summary.missed > 0 ? STAT_TONES.rose : STAT_TONES.neutral,
      href: hrefs.missed,
    },
    {
      label: "Needs a date",
      value: summary.needsDate,
      note:
        summary.needsDateDeals > 0
          ? `${plural(summary.needsDateDeals, "brand deal")} waiting`
          : summary.needsDate > 0
            ? "All your own ideas"
            : "Everything has a day",
      icon: CalendarClock,
      tone: summary.needsDateDeals > 0 ? STAT_TONES.info : STAT_TONES.neutral,
      href: hrefs.needsDate,
    },
    {
      label: "Posted this month",
      value: summary.postedThisMonth,
      note:
        summary.plannedThisMonth > 0
          ? `${summary.plannedThisMonth} more planned`
          : "Nothing else planned",
      icon: CalendarCheck2,
      tone: summary.postedThisMonth > 0 ? STAT_TONES.cash : STAT_TONES.neutral,
      href: hrefs.posted,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {tiles.map((tile) => (
        <Link
          key={tile.label}
          href={tile.href}
          className="rounded-lg outline-offset-2 transition hover:ring-2 hover:ring-ring/30 focus-visible:outline-2 focus-visible:outline-ring"
        >
          <Card className={cn("h-full", tile.tone.card)}>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardDescription className="truncate">{tile.label}</CardDescription>
                <tile.icon aria-hidden className={cn("size-4 shrink-0", tile.tone.icon)} />
              </div>
              <CardTitle className={cn("text-2xl font-semibold tabular-nums", tile.tone.value)}>
                {tile.value}
              </CardTitle>
              <p className="text-xs text-muted-foreground">{tile.note}</p>
            </CardHeader>
          </Card>
        </Link>
      ))}
    </div>
  );
}
