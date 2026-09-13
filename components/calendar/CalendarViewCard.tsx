import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type {
  BoardColumn,
  CalendarPeriod,
  CalendarView,
  PostState,
} from "@/lib/contentCalendar";
import type { CampaignBrandOption } from "@/lib/campaigns";
import type { EditorVideoOption } from "@/lib/contentPlan";
import type { Campaign } from "@/repositories/campaigns";
import type { ContentItem } from "@/repositories/contentPlan";
import { CalendarBoard } from "./CalendarBoard";
import { CalendarGrid } from "./CalendarGrid";
import { CalendarViewSwitcher } from "./CalendarViewSwitcher";
import { CalendarWeekView } from "./CalendarWeekView";
import { POST_TONES } from "./postTone";

/** What the page hands over: a run of days, or the board. */
export type CalendarViewData =
  | { view: "month" | "week"; period: CalendarPeriod }
  | { view: "board"; columns: BoardColumn[] };

interface CalendarViewCardProps {
  data: CalendarViewData;
  /** Where each view opens, for the switcher. */
  viewHrefs: Record<CalendarView, string>;
  /** Whether the URL named the view, which a phone-width screen then keeps. */
  explicitView?: boolean;
  /**
   * The creator's own records, so a post opened from any view can be edited
   * in place.
   */
  contentItems?: ContentItem[];
  /** The deals behind the brand posts, for the same reason. */
  campaigns?: Campaign[];
  /** Passed through to the add and edit sheets a view opens. */
  videoOptions?: EditorVideoOption[];
  /** Passed through to a brand post's edit sheet. */
  brandOptions?: CampaignBrandOption[];
  className?: string;
}

// A colour on a grid means nothing until it is named once.
const LEGEND: { state: PostState; label: string }[] = [
  { state: "overdue", label: "Missed" },
  { state: "due", label: "This week" },
  { state: "upcoming", label: "Later" },
  { state: "posted", label: "Posted" },
];

function periodHref(period: CalendarPeriod, key: string): string {
  return `/calendar?view=${period.view}&${period.view}=${key}`;
}

function periodSummary(period: CalendarPeriod): string {
  if (period.postCount === 0) {
    return period.view === "month" ? "Pick a day to plan something" : "Nothing scheduled this week";
  }
  return `${period.postCount} post${period.postCount === 1 ? "" : "s"} scheduled`;
}

function boardSummary(columns: BoardColumn[]): string {
  const posts = columns.flatMap((column) => column.posts);
  const undated = posts.filter((post) => post.dayKey === "").length;
  return [`${posts.length} in production`, undated > 0 ? `${undated} without a date` : null]
    .filter(Boolean)
    .join(" · ");
}

// The calendar, read one of three ways. Everything around the view itself
// stays a server component: the period links and the legend need no
// JavaScript, so only the view body and the switcher ship as any.
export function CalendarViewCard({
  data,
  viewHrefs,
  explicitView = false,
  contentItems = [],
  campaigns = [],
  videoOptions = [],
  brandOptions = [],
  className,
}: CalendarViewCardProps) {
  const period = data.view === "board" ? null : data.period;
  const summary = data.view === "board" ? boardSummary(data.columns) : periodSummary(data.period);
  const shared = { contentItems, campaigns, videoOptions, brandOptions };

  return (
    <Card className={className}>
      <CardHeader>
        {/* Title on the left, the controls on the right, wrapping under it on a
            phone. The navigation is one bordered group, so previous, Today and
            next read as a single control rather than three loose icons. */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <div className="min-w-0">
            <CardTitle className="text-lg font-semibold">{period ? period.label : "Board"}</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">{summary}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {period && (
              <div className="flex items-center rounded-lg border bg-background p-0.5">
                <Button
                  asChild
                  size="icon"
                  variant="ghost"
                  aria-label={period.view === "month" ? "Previous month" : "Previous week"}
                >
                  <Link href={periodHref(period, period.previousKey)}>
                    <ChevronLeft />
                  </Link>
                </Button>
                {/* Always rendered, and inert on the current period, so the
                    arrows don't jump sideways as the creator pages through. */}
                <Button
                  asChild={period.key !== period.currentKey}
                  size="sm"
                  variant="ghost"
                  disabled={period.key === period.currentKey}
                  className="px-2.5"
                >
                  {period.key !== period.currentKey ? (
                    <Link href={periodHref(period, period.currentKey)}>Today</Link>
                  ) : (
                    "Today"
                  )}
                </Button>
                <Button
                  asChild
                  size="icon"
                  variant="ghost"
                  aria-label={period.view === "month" ? "Next month" : "Next week"}
                >
                  <Link href={periodHref(period, period.nextKey)}>
                    <ChevronRight />
                  </Link>
                </Button>
              </div>
            )}
            <CalendarViewSwitcher view={data.view} hrefs={viewHrefs} explicitView={explicitView} />
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {data.view === "month" && <CalendarGrid month={data.period} {...shared} />}
        {data.view === "week" && <CalendarWeekView period={data.period} {...shared} />}
        {data.view === "board" && <CalendarBoard columns={data.columns} {...shared} />}

        {data.view !== "board" && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {LEGEND.map(({ state, label }) => (
              <span
                key={state}
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
              >
                <span className={cn("size-2 rounded-full", POST_TONES[state].dot)} />
                {label}
              </span>
            ))}
            {/* The month grid needs its own channel for the source, since
                colour carries the state: solid is a brand deal, outlined is
                the creator's own. The week's cards say "Deal" in words. */}
            {data.view === "month" && (
              <>
                <span className="hidden h-3 w-px bg-border sm:block" />
                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="rounded bg-muted px-1 py-0.5 text-[10px] leading-none">Deal</span>
                  Brand
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="rounded px-1 py-0.5 text-[10px] leading-none ring-1 ring-inset ring-border">
                    Reel
                  </span>
                  Yours
                </span>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
