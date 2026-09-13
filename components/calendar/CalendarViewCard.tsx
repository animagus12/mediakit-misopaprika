import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { CalendarMonth, PostState } from "@/lib/contentCalendar";
import type { CampaignBrandOption } from "@/lib/campaigns";
import type { EditorVideoOption } from "@/lib/contentPlan";
import type { Campaign } from "@/repositories/campaigns";
import type { ContentItem } from "@/repositories/contentPlan";
import { CalendarGrid } from "./CalendarGrid";
import { POST_TONES } from "./postTone";

interface CalendarMonthGridProps {
  month: CalendarMonth;
  /** The month containing today, so "Today" can hide when already there. */
  currentMonthKey: string;
  /**
   * The creator's own records, so a day opened from the grid can edit what is
   * on it. Without these a cell can only add.
   */
  contentItems?: ContentItem[];
  /** The deals behind the brand pills, so one can be edited from its day. */
  campaigns?: Campaign[];
  /** Passed through to the add and edit sheets a cell opens. */
  videoOptions?: EditorVideoOption[];
  /** Passed through to a brand row's edit sheet. */
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

function monthHref(monthKey: string): string {
  return `/calendar?month=${monthKey}`;
}

// The month at a glance. Everything outside the grid itself stays a server
// component: the month links and the legend need no JavaScript, so only the
// cells (which open the add sheet) ship as any.
export function CalendarMonthGrid({
  month,
  currentMonthKey,
  contentItems = [],
  campaigns = [],
  videoOptions = [],
  brandOptions = [],
  className,
}: CalendarMonthGridProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">{month.label}</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {month.postCount === 0
                ? "Pick a day to plan something"
                : `${month.postCount} post${month.postCount === 1 ? "" : "s"} scheduled`}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button asChild size="icon" variant="ghost" aria-label="Previous month">
              <Link href={monthHref(month.previousKey)}>
                <ChevronLeft />
              </Link>
            </Button>
            {month.key !== currentMonthKey && (
              <Button asChild size="sm" variant="outline">
                <Link href="/calendar">Today</Link>
              </Button>
            )}
            <Button asChild size="icon" variant="ghost" aria-label="Next month">
              <Link href={monthHref(month.nextKey)}>
                <ChevronRight />
              </Link>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <CalendarGrid
          month={month}
          contentItems={contentItems}
          campaigns={campaigns}
          videoOptions={videoOptions}
          brandOptions={brandOptions}
        />

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {LEGEND.map(({ state, label }) => (
            <span key={state} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className={cn("size-2 rounded-full", POST_TONES[state].dot)} />
              {label}
            </span>
          ))}
          <span className="hidden h-3 w-px bg-border sm:block" />
          {/* Colour carries the state, so the source needs its own channel:
              solid is a brand deal, outlined is the creator's own. */}
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
        </div>
      </CardContent>
    </Card>
  );
}
