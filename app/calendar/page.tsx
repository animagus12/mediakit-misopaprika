import type { Metadata } from "next";
import AppShell from "@/components/common/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarMonthGrid } from "@/components/calendar/CalendarMonthGrid";
import { NewContentButton } from "@/components/calendar/NewContentButton";
import { UnscheduledPostsCard } from "@/components/calendar/UnscheduledPostsCard";
import { WeekAheadCard } from "@/components/calendar/WeekAheadCard";
import {
  buildCalendarMonth,
  resolveMonthKey,
  selectScheduledPosts,
  selectUnscheduledPosts,
  selectWeekAhead,
} from "@/lib/contentCalendar";
import { buildEditorVideoOptions } from "@/lib/contentPlan";
import { monthKeyOf, todayKey } from "@/lib/day";
import { campaignRepository } from "@/repositories/campaignRepository";
import { getContentItems } from "@/repositories/contentPlan.writer.server";
import { getEditorTransactions } from "@/repositories/editorTransactions.writer.server";
import type { Campaign } from "@/repositories/campaigns";
import type { ContentItem } from "@/repositories/contentPlan";
import type { EditorTransaction } from "@/repositories/editorTransactions";

export const metadata: Metadata = {
  title: "Content calendar - @misopaprika",
  robots: { index: false, follow: false },
};

// Every other page in the app is invalidated by a write, which lib/revalidation
// handles. This one is also invalidated by the clock: nothing is written when
// tomorrow becomes today, but "Due tomorrow" becomes "Due today" and the
// highlighted cell moves. A cached render would quietly hold last week's
// reminders, which is the one thing a reminder must never do.
export const dynamic = "force-dynamic";

interface CalendarPageProps {
  searchParams: Promise<{ month?: string }>;
}

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const { month } = await searchParams;
  // One clock for the whole render, so the grid's "today", the reminder labels
  // and the waiting counts can't disagree by a millisecond across midnight.
  const now = new Date();

  let campaigns: Campaign[] = [];
  let contentItems: ContentItem[] = [];
  let error: string | null = null;
  try {
    [campaigns, contentItems] = await Promise.all([
      campaignRepository.getAll(),
      getContentItems(),
    ]);
  } catch (err) {
    error = err instanceof Error ? err.message : "Something went wrong";
  }

  // The editing workspace is a convenience here, not the page's subject: a
  // failure to read it costs the picker, not the calendar, so it is caught
  // separately rather than joining the two above.
  const editorTransactions: EditorTransaction[] = await getEditorTransactions().catch(() => []);

  const scheduled = selectScheduledPosts(campaigns, contentItems, now);
  const monthView = buildCalendarMonth(resolveMonthKey(month, now), scheduled, now);
  // Rows carry ids, not records; the editable ones look themselves up here so
  // the view models stay flat and free of the whole stored object.
  const contentById = new Map(contentItems.map((item) => [item.id, item]));
  // Built once for the page: every sheet on it offers the same list, and the
  // "already planned" marks are computed against the same content items the
  // rest of the page is rendering.
  const videoOptions = buildEditorVideoOptions(editorTransactions, contentItems);

  return (
    <AppShell>
      <div className="mx-auto max-w-screen-lg xl:max-w-6xl 2xl:max-w-[1440px] space-y-8 px-4 py-10">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <h1 className="font-heading text-lg font-semibold">Content calendar</h1>
            <p className="text-xs text-muted-foreground">
              Your own posts and every brand deal on one plan.
            </p>
          </div>
          <NewContentButton videoOptions={videoOptions} />
        </div>

        {error ? (
          <Card>
            <CardContent className="py-6 text-xs text-muted-foreground">
              Couldn&apos;t load the calendar: {error}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            <WeekAheadCard
              posts={selectWeekAhead(scheduled)}
              contentById={contentById}
              videoOptions={videoOptions}
              schedulable
              emptyState="card"
            />

            <CalendarMonthGrid
              month={monthView}
              currentMonthKey={monthKeyOf(todayKey(now))}
              videoOptions={videoOptions}
            />

            <UnscheduledPostsCard
              posts={selectUnscheduledPosts(campaigns, contentItems, now)}
              contentById={contentById}
              videoOptions={videoOptions}
            />
          </div>
        )}
      </div>
    </AppShell>
  );
}
