import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { userAgent } from "next/server";
import AppShell from "@/components/common/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import {
  CalendarViewCard,
  type CalendarViewData,
} from "@/components/calendar/CalendarViewCard";
import { CalendarStats } from "@/components/calendar/CalendarStats";
import { NeedsDateCard } from "@/components/calendar/NeedsDateCard";
import { NewContentButton } from "@/components/calendar/NewContentButton";
import { UpNextCard } from "@/components/calendar/UpNextCard";
import {
  CALENDAR_VIEW_COOKIE,
  buildCalendarMonth,
  buildCalendarWeek,
  groupAgenda,
  hasExplicitCalendarView,
  resolveCalendarAnchors,
  resolveCalendarView,
  selectBoard,
  selectScheduledPosts,
  selectUnscheduledPosts,
  selectWeekAhead,
  summarizeCalendar,
  type CalendarView,
} from "@/lib/contentCalendar";
import { formatDayLabel, todayKey } from "@/lib/day";
import { buildEditorVideoOptions } from "@/lib/contentPlan";
import { buildCampaignBrandOptions } from "@/lib/campaigns";
import { campaignRepository } from "@/repositories/campaignRepository";
import { getContentItems } from "@/repositories/contentPlan.writer.server";
import { getEditorTransactions } from "@/repositories/editorTransactions.writer.server";
import { getBrands } from "@/repositories/brands.writer.server";
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
  searchParams: Promise<{ view?: string; month?: string; week?: string }>;
}

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const [{ view: viewParam, month, week }, cookieStore, headerList] = await Promise.all([
    searchParams,
    cookies(),
    headers(),
  ]);
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

  // The editing workspace and the brand book are conveniences here, not the
  // page's subject: a failure to read either costs a picker inside a form,
  // not the calendar, so both are caught separately rather than joining the
  // two above.
  const [editorTransactions, brands] = await Promise.all([
    getEditorTransactions().catch((): EditorTransaction[] => []),
    getBrands().catch(() => []),
  ]);

  const today = todayKey(now);
  const scheduled = selectScheduledPosts(campaigns, contentItems, now);
  const unscheduled = selectUnscheduledPosts(campaigns, contentItems, now);

  // A phone opens on the week, since a month grid there can show a post only
  // as a dot. Read from the user agent, and from the mobile client hint
  // Chromium sends even when its user agent string is reduced. A phone either
  // misses (a "desktop site" request, say) is caught in the browser by width:
  // see CalendarViewSwitcher.
  const mobile =
    userAgent({ headers: headerList }).device.type === "mobile" ||
    headerList.get("sec-ch-ua-mobile") === "?1";
  const view = resolveCalendarView({
    view: viewParam,
    month,
    week,
    remembered: cookieStore.get(CALENDAR_VIEW_COOKIE)?.value,
    mobile,
  });
  const explicitView = hasExplicitCalendarView({ view: viewParam, month, week });
  const { monthKey, weekKey } = resolveCalendarAnchors({ month, week }, now);
  // Only the view on screen is built: the other two are a link away.
  const viewData: CalendarViewData =
    view === "board"
      ? { view, columns: selectBoard(scheduled, unscheduled) }
      : {
          view,
          period:
            view === "week"
              ? buildCalendarWeek(weekKey, scheduled, now)
              : buildCalendarMonth(monthKey, scheduled, now),
        };
  const viewHrefs: Record<CalendarView, string> = {
    month: `/calendar?view=month&month=${monthKey}`,
    week: `/calendar?view=week&week=${weekKey}`,
    board: `/calendar?view=board`,
  };
  // Each tile opens where its posts are listed. The two that span weeks (what
  // was missed, and the next seven days) go to the agenda, which rolls with
  // today; the undated go to the board, the only view that holds them all.
  const statHrefs = {
    dueSoon: "#up-next",
    missed: "#up-next",
    needsDate: viewHrefs.board,
    posted: `/calendar?view=month&month=${today.slice(0, 7)}`,
  };
  // Rows carry ids, not records; the editable ones look themselves up here so
  // the view models stay flat and free of the whole stored object.
  const contentById = new Map(contentItems.map((item) => [item.id, item]));
  const campaignById = new Map(campaigns.map((campaign) => [campaign.id, campaign]));
  // Built once for the page: every sheet on it offers the same list, and the
  // "already planned" marks are computed against the same content items the
  // rest of the page is rendering.
  // Both stores that can claim a cut are counted, so a job already on the
  // plan or on a deal is offered marked rather than as free.
  const videoOptions = buildEditorVideoOptions(editorTransactions, [
    ...contentItems,
    ...campaigns,
  ]);
  // Every sheet on this page that can edit a deal offers the same brand list
  // /campaigns does, so the two cannot disagree about what a brand is called.
  const brandOptions = buildCampaignBrandOptions(brands);

  return (
    <AppShell>
      <div className="mx-auto max-w-screen-lg xl:max-w-6xl 2xl:max-w-[1440px] space-y-8 px-4 py-10">
        <div className="flex items-end justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-medium text-primary">Today is {formatDayLabel(today)}</p>
            <h1 className="font-heading text-xl font-semibold tracking-tight">Content calendar</h1>
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
          <div className="space-y-6">
            <CalendarStats
              summary={summarizeCalendar(scheduled, unscheduled, now)}
              hrefs={statHrefs}
            />

            {/* The calendar leads: it carries both what is planned and the
                stage each post is at, which is what this page is opened for. */}
            <CalendarViewCard
              data={viewData}
              viewHrefs={viewHrefs}
              explicitView={explicitView}
              contentItems={contentItems}
              campaigns={campaigns}
              videoOptions={videoOptions}
              brandOptions={brandOptions}
            />

            {/* Side by side from lg: the "act on it now" list and the backlog
                are read together, and stacked they ran to a screen and a half
                below the calendar. */}
            <div className="grid items-start gap-6 lg:grid-cols-2">
              <UpNextCard
                groups={groupAgenda(selectWeekAhead(scheduled))}
                today={today}
                contentById={contentById}
                campaignById={campaignById}
                videoOptions={videoOptions}
                brandOptions={brandOptions}
              />
              <NeedsDateCard
                posts={unscheduled}
                today={today}
                contentById={contentById}
                campaignById={campaignById}
                videoOptions={videoOptions}
                brandOptions={brandOptions}
              />
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
