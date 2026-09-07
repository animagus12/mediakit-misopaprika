import Link from "next/link";
import { AlarmClock, ArrowUpRight, CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDayLabel } from "@/lib/day";
import { WEEK_AHEAD_DAYS } from "@/lib/contentCalendar";
import { cn } from "@/lib/utils";
import type { ScheduledPost } from "@/lib/contentCalendar";
import type { EditorVideoOption } from "@/lib/contentPlan";
import type { ContentItem } from "@/repositories/contentPlan";
import { PostRow } from "./PostRow";
import { POST_TONES } from "./postTone";

interface WeekAheadCardProps {
  /** Already filtered to overdue + due, soonest first: see selectWeekAhead. */
  posts: ScheduledPost[];
  /**
   * The creator's own records, keyed by id, so an own row can be edited in
   * place. Omitted on the dashboard, where the card is a pointer rather than
   * a workspace.
   */
  contentById?: Map<string, ContentItem>;
  /** Passed through to an own row's edit sheet. */
  videoOptions?: EditorVideoOption[];
  /** Renders each row with the date field that can move it. */
  schedulable?: boolean;
  /**
   * What a clear week looks like.
   *
   * "card" is /calendar's: a section that silently vanished there would read
   * as a page that failed to load. "line" is the dashboard's, where the news
   * is worth one row and not a panel. "hidden" renders nothing.
   */
  emptyState?: "hidden" | "line" | "card";
  /**
   * How many posts have no day at all, for the one-liner.
   *
   * Without it, a clear week and an unplanned one read identically, and they
   * are opposite situations: the first means the work is done, the second
   * that it was never scheduled. Only the "line" variant uses this.
   */
  waitingCount?: number;
  /** Adds a link out of the card header, for the dashboard's copy of it. */
  href?: string;
  className?: string;
}

// The reminder the calendar exists for: what has to go out in the next week,
// and what should already have gone out. Overdue rows lead, because a post
// that was missed is the only thing here that can't be fixed by waiting.
export function WeekAheadCard({
  posts,
  contentById,
  videoOptions,
  schedulable = false,
  emptyState = "hidden",
  waitingCount = 0,
  href,
  className,
}: WeekAheadCardProps) {
  if (posts.length === 0) {
    if (emptyState === "hidden") return null;

    if (emptyState === "line") {
      // Nothing due is only good news when there is also nothing waiting to be
      // given a day, so the two cases get different words and different
      // colour: a clear week earns the positive tone, an unplanned one stays
      // muted and names the backlog it is quietly sitting on.
      const clear = waitingCount === 0;
      return (
        <Card className={className}>
          <CardContent className="flex items-center justify-between gap-3 py-3">
            {/* Wraps rather than truncating: at 390px the line needs 341px,
                and the half that would be cut is the half that says anything
                ("3 waiting for a date"). Two lines on a phone is still a row,
                not a panel. */}
            <p className="flex min-w-0 items-start gap-2 text-sm">
              <CalendarCheck
                className={cn(
                  // mt-0.5 against items-start, so the icon sits on the first
                  // line when the text wraps: same trick ActivityRow uses.
                  "mt-0.5 size-4 shrink-0",
                  clear ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                )}
              />
              <span>
                {clear ? (
                  <>
                    <span className="font-medium">All caught up.</span>{" "}
                    <span className="text-muted-foreground">
                      Nothing to publish this week.
                    </span>
                  </>
                ) : (
                  <>
                    <span className="font-medium">Nothing planned this week.</span>{" "}
                    <span className="text-muted-foreground">
                      {waitingCount} waiting for a date.
                    </span>
                  </>
                )}
              </span>
            </p>
            {href && (
              <Button asChild size="sm" variant="ghost" className="shrink-0">
                <Link href={href}>
                  Calendar
                  <ArrowUpRight />
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
          <CalendarCheck className="size-5 text-muted-foreground" />
          <p className="text-sm font-medium">Nothing due this week</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Nothing is scheduled in the next {WEEK_AHEAD_DAYS} days, and nothing scheduled earlier
            is still waiting to go out.
          </p>
        </CardContent>
      </Card>
    );
  }

  const overdue = posts.filter((post) => post.state === "overdue").length;
  // Counted separately from "overdue": a post can be on time and still be
  // unshot, which is the warning the creator can still act on.
  const behind = posts.filter((post) => post.behind && post.state !== "overdue").length;

  return (
    <Card className={cn("bg-amber-500/5 ring-amber-500/15", className)}>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlarmClock className="size-4 text-amber-600 dark:text-amber-400" />
            <CardDescription>This week</CardDescription>
          </div>
          {href && (
            <Button asChild size="sm" variant="ghost">
              <Link href={href}>
                Calendar
                <ArrowUpRight />
              </Link>
            </Button>
          )}
        </div>
        <CardTitle className="text-lg text-amber-600 dark:text-amber-400">
          {posts.length} post{posts.length === 1 ? "" : "s"} to publish
          {(overdue > 0 || behind > 0) && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {[
                overdue > 0 ? `${overdue} overdue` : null,
                behind > 0 ? `${behind} not ready` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-0.5">
        {posts.map((post) => (
          <PostRow
            key={post.key}
            source={post.source}
            id={post.id}
            title={post.title}
            detail={post.detail}
            status={post.status}
            primaryMeta={post.label}
            secondaryMeta={formatDayLabel(post.dayKey)}
            metaClassName={POST_TONES[post.state].text}
            behind={post.behind}
            schedulable={schedulable}
            currentIsoDate={post.dayKey}
            item={post.source === "own" ? contentById?.get(post.id) : undefined}
            videoOptions={videoOptions}
          />
        ))}
      </CardContent>
    </Card>
  );
}
