import {
  addDays,
  addMonths,
  dayKeyOf,
  daysBetween,
  daysInMonth,
  formatDayLabel,
  formatMonthLabel,
  formatWeekLabel,
  isDayKey,
  isMonthKey,
  monthKeyOf,
  startOfWeek,
  todayKey,
  weekdayIndex,
} from "@/lib/day";
import { isCampaignCalledOff, toIsoDate, toSheetDate } from "@/lib/campaigns";
import { contentLabel, isProductionReady } from "@/lib/contentPlan";
import { formatMoney } from "@/lib/invoice";
import type { Campaign } from "@/repositories/campaigns";
import type { ContentItem } from "@/repositories/contentPlan";
import type { WorkflowStatus } from "@/repositories/workflowStatus";

// The content calendar's view models. Two stores feed it and it renders one
// timeline: brand deals from ./campaigns, and the creator's own reels from
// ./contentPlan.
//
// The join happens here rather than in storage. A deal carries a brand,
// money, an invoice and a payment status; an own reel carries a production
// status and nothing else. What they share is a day, so they are flattened
// into one shape at the point of display and kept apart everywhere else.
//
// A campaign's posting day is its Upload date, the field the creator already
// fills in for "when does this go live". An own reel's is its postDate. Which
// of "planned" or "posted" a day means is answered by the status in both
// cases, not by a second date field (see postState below). Both stores speak
// the same status vocabulary (repositories/workflowStatus.ts), so every rule
// below reads a deal's status and a reel's the same way.
//
// Client-safe on purpose: the page is a server component, but the controls
// that schedule and edit are not, and both render the same rows.

/** How many days ahead still counts as "this week" for the reminder list. */
export const WEEK_AHEAD_DAYS = 7;

// How close a posting day has to be before work that has not been finished is
// worth warning about. Two days is the point at which "I still have to shoot
// this" stops being a plan and starts being a problem.
const BEHIND_DAYS = 2;

const NO_STORY = "none";

export type PostState = "posted" | "overdue" | "due" | "upcoming";

/** Which store a row came from. Decides where an edit or a schedule is sent. */
export type PostSource = "campaign" | "own";

/** The working stages, in order. Everything from Posted on has left the pipeline. */
export type PipelineStage = Extract<
  WorkflowStatus,
  "Idea" | "Scripting" | "Filming" | "Editing" | "Ready"
>;

export const PIPELINE_STAGES: PipelineStage[] = ["Idea", "Scripting", "Filming", "Editing", "Ready"];

// A working stage is its own status, for a deal and a reel alike. The two
// deal-only statuses before it, Discussion and In Route, have nothing to shoot
// yet, so they file under Idea: not started, the safe direction.
function pipelineStageOf(status: WorkflowStatus): PipelineStage {
  return (PIPELINE_STAGES as WorkflowStatus[]).includes(status) ? (status as PipelineStage) : "Idea";
}

/**
 * The record's own status when its stage shows another word, which is only a
 * deal in Discussion or In Route, filed under Idea. Undefined whenever the
 * stage already says it, so a card never repeats itself.
 */
export function statusNoteOf(post: {
  status: WorkflowStatus;
  stage: PipelineStage | null;
}): WorkflowStatus | undefined {
  return post.stage && post.status !== post.stage ? post.status : undefined;
}

export interface ScheduledPost {
  /** Unique across both stores, for React keys and nothing else. */
  key: string;
  /** The record's own id, for the action that writes to its store. */
  id: string;
  source: PostSource;
  /** Headline: the brand for a deal, the title for an own reel. */
  title: string;
  /** "Summer drop · 1 Reel, 1 Story", or "Reel". */
  detail: string;
  /** The record's status, shown as-is: "Discussion", "Filming". */
  status: WorkflowStatus;
  /**
   * `status` placed on the shared pipeline: the status itself for a working
   * stage, Idea for a deal not yet started. Null once posted: `state` already
   * says so, and a finished post has no stage left to be at.
   */
  stage: PipelineStage | null;
  /** yyyy-mm-dd, the day this posts on. */
  dayKey: string;
  /** DD/MM/YYYY, as stored. */
  date: string;
  state: PostState;
  /** Whole days from today; negative once the day has passed. */
  daysAway: number;
  /** "Posted", "Today", "In 3 days", "Overdue by 2 days". */
  label: string;
  /**
   * The day is within BEHIND_DAYS (or gone) and the work is not finished.
   *
   * The one thing a planner owes its reader that a calendar does not: three
   * reels this week reads very differently when none of them are shot.
   */
  behind: boolean;
}

export interface UnscheduledPost {
  key: string;
  id: string;
  source: PostSource;
  title: string;
  /** "Summer drop · 1 Reel, 1 Story · ₹6,685", or "Reel". */
  detail: string;
  status: WorkflowStatus;
  /** `status` placed on the shared pipeline, the same way a scheduled post's is. */
  stage: PipelineStage;
  /** Days it has gone without a day: since the deal date, or since created. */
  ageDays: number | null;
}

function normalized(value: string): string {
  return value.trim().toLowerCase();
}

// "None" is a real value of the Story field, and listing it as a deliverable
// would have the calendar promising a story that was never part of the deal.
export function deliverablesLabel(campaign: Campaign): string {
  return [campaign.reels, campaign.story]
    .map((part) => part.trim())
    .filter((part) => part !== "" && normalized(part) !== NO_STORY)
    .join(", ");
}

function joinDetail(parts: (string | null | undefined)[]): string {
  return parts.map((part) => part?.trim() ?? "").filter(Boolean).join(" · ");
}

// Whether a posting day records something that already happened or plans
// something that hasn't. The status is what separates them: a day in the past
// on work still sitting in "Filming" is a post that was missed, which is
// exactly the thing worth surfacing, and treating every past day as posted
// would hide it.
function stateOf(posted: boolean, daysAway: number): PostState {
  if (posted) return "posted";
  if (daysAway < 0) return "overdue";
  return daysAway <= WEEK_AHEAD_DAYS ? "due" : "upcoming";
}

function postLabel(state: PostState, daysAway: number): string {
  if (state === "posted") return "Posted";
  if (daysAway < 0) {
    const days = Math.abs(daysAway);
    return `Overdue by ${days} day${days === 1 ? "" : "s"}`;
  }
  if (daysAway === 0) return "Today";
  if (daysAway === 1) return "Tomorrow";
  return `In ${daysAway} days`;
}

function isBehind(state: PostState, daysAway: number, ready: boolean): boolean {
  if (ready || state === "posted") return false;
  return daysAway <= BEHIND_DAYS;
}

// Read from the status a ScheduledPost already carries, so a post can be
// re-timed after a move without the record behind it.
function stageOfPost(status: WorkflowStatus): PipelineStage | null {
  return status === "Posted" ? null : pipelineStageOf(status);
}

type PostTiming =Pick<ScheduledPost, "dayKey" | "daysAway" | "state" | "label" | "behind">;

// Everything about a post that follows from its day. One function for both
// stores and for a move, so a post dragged to another day is toned by exactly
// the rule the server would have used.
function timingOf(status: WorkflowStatus, dayKey: string, today: string): PostTiming {
  const daysAway = daysBetween(today, dayKey);
  const state = stateOf(status === "Posted", daysAway);
  return {
    dayKey,
    daysAway,
    state,
    label: postLabel(state, daysAway),
    behind: isBehind(state, daysAway, isProductionReady(status)),
  };
}

function scheduledFromCampaign(campaign: Campaign, today: string): ScheduledPost | null {
  // A deal that was called off never belonged on a schedule, matching
  // selectDuePayments and selectAttentionItems.
  if (isCampaignCalledOff(campaign.status)) return null;
  const dayKey = toIsoDate(campaign.uploadDate);
  // toIsoDate answers "" for a blank or malformed date; both mean the deal has
  // no day to sit on, and the unscheduled list picks it up instead.
  if (dayKey === "") return null;

  return {
    key: `campaign:${campaign.id}`,
    id: campaign.id,
    source: "campaign",
    title: campaign.brand.trim() || campaign.campaign.trim() || "Untitled deal",
    detail: joinDetail([campaign.campaign, deliverablesLabel(campaign)]),
    status: campaign.status,
    stage: stageOfPost(campaign.status),
    date: campaign.uploadDate,
    ...timingOf(campaign.status, dayKey, today),
  };
}

function scheduledFromContent(item: ContentItem, today: string): ScheduledPost | null {
  if (item.status === "Cancelled") return null;
  const dayKey = toIsoDate(item.postDate);
  if (dayKey === "") return null;

  return {
    key: `own:${item.id}`,
    id: item.id,
    source: "own",
    title: contentLabel(item.title),
    detail: item.format,
    status: item.status,
    stage: stageOfPost(item.status),
    date: item.postDate,
    ...timingOf(item.status, dayKey, today),
  };
}

/**
 * Everything with a posting day, from both stores, oldest first.
 *
 * `now` is injectable so a server render and a test aren't at the mercy of the
 * wall clock, the same shape selectDuePayments uses.
 */
export function selectScheduledPosts(
  campaigns: Campaign[],
  contentItems: ContentItem[] = [],
  now: Date = new Date()
): ScheduledPost[] {
  const today = todayKey(now);
  const posts = [
    ...campaigns.map((campaign) => scheduledFromCampaign(campaign, today)),
    ...contentItems.map((item) => scheduledFromContent(item, today)),
  ].filter((post): post is ScheduledPost => post !== null);

  return posts.sort(comparePosts);
}

// Within a day, brand deals lead: they are the ones with a counterparty
// waiting on them. Title breaks the remaining ties so the order is stable
// between renders rather than following whatever the stores happened to
// return.
function comparePosts(a: ScheduledPost, b: ScheduledPost): number {
  return (
    a.dayKey.localeCompare(b.dayKey) ||
    Number(a.source === "own") - Number(b.source === "own") ||
    a.title.localeCompare(b.title)
  );
}

/**
 * Live work with no posting day on it: deals that still have to be scheduled,
 * and the ideas backlog.
 *
 * Only active-stage records qualify. A finished or cancelled deal with no
 * upload date is a gap in the record rather than something to schedule, and
 * NeedsAttentionCard is where those already surface; a Posted or Cancelled idea
 * is simply done with.
 */
export function selectUnscheduledPosts(
  campaigns: Campaign[],
  contentItems: ContentItem[] = [],
  now: Date = new Date()
): UnscheduledPost[] {
  const today = todayKey(now);

  const deals = campaigns
    .filter((campaign) => campaign.stage === "active" && toIsoDate(campaign.uploadDate) === "")
    .map((campaign): UnscheduledPost => {
      const dealDayKey = toIsoDate(campaign.date);
      return {
        key: `campaign:${campaign.id}`,
        id: campaign.id,
        source: "campaign",
        title: campaign.brand.trim() || campaign.campaign.trim() || "Untitled deal",
        detail: joinDetail([
          campaign.campaign,
          deliverablesLabel(campaign),
          campaign.total > 0 ? formatMoney(campaign.total) : null,
        ]),
        status: campaign.status,
        stage: pipelineStageOf(campaign.status),
        // Aged from the deal date: how long ago the creator agreed to make
        // this is the only clock available, and the right one.
        ageDays: dealDayKey === "" ? null : daysBetween(dealDayKey, today),
      };
    });

  const ideas = contentItems
    .filter((item) => item.stage === "active" && toIsoDate(item.postDate) === "")
    .map((item): UnscheduledPost => ({
      key: `own:${item.id}`,
      id: item.id,
      source: "own",
      title: contentLabel(item.title),
      detail: item.format,
      status: item.status,
      stage: pipelineStageOf(item.status),
      // An idea has no deal date, so it is aged from when it was written
      // down. createdAt is a full ISO instant and these ages are whole civil
      // days, so it is reduced to a day first.
      ageDays: daysBetween(dayKeyOf(item.createdAt), today),
    }));

  // Oldest first, whichever store it came from: the thing that has been
  // waiting longest for a day is the one most likely to be forgotten. Records
  // with no usable date sort last, since there is nothing to say how long they
  // have sat there.
  return [...deals, ...ideas].sort((a, b) => (b.ageDays ?? -1) - (a.ageDays ?? -1));
}

/**
 * The reminder list: work already missed, plus everything landing in the next
 * WEEK_AHEAD_DAYS days, soonest first. Anything already posted is left out,
 * which is what makes this list empty itself as the week is worked through
 * rather than growing.
 */
export function selectWeekAhead(posts: ScheduledPost[]): ScheduledPost[] {
  return posts.filter((post) => post.state === "overdue" || post.state === "due");
}

/** The four figures the page opens on, each a question the creator acts on. */
export interface CalendarSummary {
  /** Landing in the next WEEK_AHEAD_DAYS days, not yet posted. */
  dueSoon: number;
  /** Of those and the missed ones, how many are close and still not ready. */
  notReady: number;
  /** Past their day and still not posted. */
  missed: number;
  /** Live work with no day at all. */
  needsDate: number;
  /** Of the undated, how many are brand deals, which have someone waiting. */
  needsDateDeals: number;
  /** Posted on a day in the current month. */
  postedThisMonth: number;
  /** Still planned for the rest of the current month. */
  plannedThisMonth: number;
}

/**
 * The page's headline figures, from the two lists the page already built, so
 * a tile can never count something the views below it don't show.
 */
export function summarizeCalendar(
  scheduled: ScheduledPost[],
  unscheduled: UnscheduledPost[],
  now: Date = new Date()
): CalendarSummary {
  const month = monthKeyOf(todayKey(now));
  const inMonth = scheduled.filter((post) => monthKeyOf(post.dayKey) === month);
  const actionable = selectWeekAhead(scheduled);

  return {
    dueSoon: scheduled.filter((post) => post.state === "due").length,
    notReady: actionable.filter((post) => post.behind).length,
    missed: scheduled.filter((post) => post.state === "overdue").length,
    needsDate: unscheduled.length,
    needsDateDeals: unscheduled.filter((post) => post.source === "campaign").length,
    postedThisMonth: inMonth.filter((post) => post.state === "posted").length,
    plannedThisMonth: inMonth.filter((post) => post.state === "due" || post.state === "upcoming")
      .length,
  };
}

/** One heading of the agenda: every missed post, or one day's posts. */
export interface AgendaGroup {
  /** "missed", or the yyyy-mm-dd of the day. */
  key: string;
  /** "Missed", "Today", "Tomorrow", "Wed 16 Sept". */
  label: string;
  /** "Sun 13 Sept" beside Today and Tomorrow, so the heading still names a date. */
  date: string;
  missed: boolean;
  posts: ScheduledPost[];
}

/**
 * The reminder list grouped under day headings, missed work first as one
 * group: a missed post's day is history, and what it needs is a new one.
 * Expects selectWeekAhead's output, which is already soonest first.
 */
export function groupAgenda(posts: ScheduledPost[]): AgendaGroup[] {
  const missed = posts.filter((post) => post.state === "overdue");
  const groups: AgendaGroup[] = [];
  if (missed.length > 0) {
    groups.push({ key: "missed", label: "Missed", date: "", missed: true, posts: missed });
  }

  for (const [dayKey, dayPosts] of postsByDay(posts.filter((post) => post.state !== "overdue"))) {
    const { daysAway } = dayPosts[0];
    const relative = daysAway === 0 ? "Today" : daysAway === 1 ? "Tomorrow" : null;
    groups.push({
      key: dayKey,
      label: relative ?? formatDayLabel(dayKey),
      date: relative ? formatDayLabel(dayKey) : "",
      missed: false,
      posts: dayPosts,
    });
  }
  return groups;
}

export interface CalendarDay {
  key: string; // yyyy-mm-dd
  dayOfMonth: number;
  /**
   * False for the leading/trailing days that square a month grid off. Always
   * true in a week, where every day shown is the week's own.
   */
  inPeriod: boolean;
  isToday: boolean;
  posts: ScheduledPost[];
}

// --- Views --------------------------------------------------------------------
// The calendar is read three ways. A month grid plans ahead but can only spare
// a dot per post on a phone; a week has room for every post in full; the
// board drops the date axis entirely and answers "how far along is
// everything", undated ideas included.

export type CalendarView = "month" | "week" | "board";

export const CALENDAR_VIEWS: CalendarView[] = ["month", "week", "board"];

/** The cookie the last-picked view is remembered in. */
export const CALENDAR_VIEW_COOKIE = "calendar_view";

export function isCalendarView(value: string | undefined): value is CalendarView {
  return (CALENDAR_VIEWS as string[]).includes(value ?? "");
}

/**
 * Which view a request gets, most explicit first: the URL, then a month or
 * week anchor in the URL (so an old `?month=` link still opens a month). With
 * neither, a phone always opens on the week: a month grid is the wrong shape
 * at 390px, where a post is only a dot, so a Month picked once on a phone is
 * not carried into the next visit. Anywhere else the last-picked view is
 * remembered, and a month is the fallback.
 */
export function resolveCalendarView(input: {
  view?: string;
  month?: string;
  week?: string;
  remembered?: string;
  mobile: boolean;
}): CalendarView {
  if (isCalendarView(input.view)) return input.view;
  if (input.week) return "week";
  if (input.month) return "month";
  if (input.mobile) return "week";
  return isCalendarView(input.remembered) ? input.remembered : "month";
}

/** Whether the URL names a view or a period, which then outranks the device. */
export function hasExplicitCalendarView(input: {
  view?: string;
  month?: string;
  week?: string;
}): boolean {
  return isCalendarView(input.view) || Boolean(input.week) || Boolean(input.month);
}

/** A run of days a view lays out: a squared-off month, or one week. */
export interface CalendarPeriod {
  view: "month" | "week";
  /** yyyy-mm for a month; yyyy-mm-dd of the Monday for a week. */
  key: string;
  /** yyyy-mm-dd the period was built against, so a moved post can be re-timed. */
  today: string;
  label: string; // "September 2026", "14 – 20 Sept 2026"
  previousKey: string;
  nextKey: string;
  /** The key of the period containing today, so "Today" can hide when there. */
  currentKey: string;
  /** Monday-first rows; a week is a single row. */
  weeks: CalendarDay[][];
  /** Posts landing on the period's own days, not on the padding. */
  postCount: number;
}

function postsByDay(posts: ScheduledPost[]): Map<string, ScheduledPost[]> {
  const byDay = new Map<string, ScheduledPost[]>();
  for (const post of posts) {
    const existing = byDay.get(post.dayKey);
    if (existing) existing.push(post);
    else byDay.set(post.dayKey, [post]);
  }
  return byDay;
}

function countInPeriod(weeks: CalendarDay[][]): number {
  return weeks.flat().reduce((sum, day) => sum + (day.inPeriod ? day.posts.length : 0), 0);
}

/**
 * A month laid out as Monday-first weeks, each day carrying the posts that
 * land on it.
 *
 * The grid is squared off with the neighbouring months' days rather than with
 * blanks, so a post falling on the 1st of next month is still visible from the
 * last row of this one, which is the row the creator is looking at during the
 * last week of a month.
 */
export function buildCalendarMonth(
  monthKey: string,
  posts: ScheduledPost[],
  now: Date = new Date()
): CalendarPeriod {
  const today = todayKey(now);
  const byDay = postsByDay(posts);

  const monthDays = daysInMonth(monthKey);
  const leading = weekdayIndex(monthDays[0]);
  // Ceil rather than a fixed six rows: a 28-day February starting on a Monday
  // needs four, and a dead row reads as a bug.
  const cellCount = Math.ceil((leading + monthDays.length) / 7) * 7;
  const firstCell = addDays(monthDays[0], -leading);

  const weeks: CalendarDay[][] = [];
  for (let index = 0; index < cellCount; index += 1) {
    const key = addDays(firstCell, index);
    if (index % 7 === 0) weeks.push([]);
    weeks[weeks.length - 1].push({
      key,
      dayOfMonth: Number(key.slice(8)),
      inPeriod: monthKeyOf(key) === monthKey,
      isToday: key === today,
      posts: byDay.get(key) ?? [],
    });
  }

  return {
    view: "month",
    key: monthKey,
    today,
    label: formatMonthLabel(monthKey),
    previousKey: addMonths(monthKey, -1),
    nextKey: addMonths(monthKey, 1),
    currentKey: monthKeyOf(today),
    weeks,
    postCount: countInPeriod(weeks),
  };
}

/** One Monday-to-Sunday week, each day carrying the posts that land on it. */
export function buildCalendarWeek(
  weekKey: string,
  posts: ScheduledPost[],
  now: Date = new Date()
): CalendarPeriod {
  const today = todayKey(now);
  const monday = startOfWeek(weekKey);
  const byDay = postsByDay(posts);

  const days = Array.from({ length: 7 }, (_, index): CalendarDay => {
    const key = addDays(monday, index);
    return {
      key,
      dayOfMonth: Number(key.slice(8)),
      inPeriod: true,
      isToday: key === today,
      posts: byDay.get(key) ?? [],
    };
  });

  return {
    view: "week",
    key: monday,
    today,
    label: formatWeekLabel(monday),
    previousKey: addDays(monday, -7),
    nextKey: addDays(monday, 7),
    currentKey: startOfWeek(today),
    weeks: [days],
    postCount: countInPeriod([days]),
  };
}

/**
 * The period with one post moved to another day, as a drag or a "Move" menu
 * leaves it. `toDayKey` "" takes the post off the calendar altogether.
 *
 * Pure, so a view can show a move the moment it happens and let the server's
 * render replace it once the write lands. The post is re-timed against the
 * day the period was built on, so a post dragged into the past turns red
 * immediately rather than only after the round trip. A day outside the period
 * simply drops the post from view, which is where it has gone.
 *
 * Answers the period unchanged when the post isn't on it or isn't moving.
 */
export function movePostInPeriod(
  period: CalendarPeriod,
  postKey: string,
  toDayKey: string
): CalendarPeriod {
  let moved: ScheduledPost | undefined;
  for (const day of period.weeks.flat()) {
    moved ??= day.posts.find((post) => post.key === postKey);
  }
  if (!moved || moved.dayKey === toDayKey) return period;

  const post: ScheduledPost | null = toDayKey
    ? { ...moved, ...timingOf(moved.status, toDayKey, period.today) }
    : null;

  const weeks = period.weeks.map((week) =>
    week.map((day) => {
      if (day.key === moved.dayKey) {
        return { ...day, posts: day.posts.filter((entry) => entry.key !== postKey) };
      }
      if (post && day.key === toDayKey) {
        return { ...day, posts: [...day.posts, post].sort(comparePosts) };
      }
      return day;
    })
  );

  return { ...period, weeks, postCount: countInPeriod(weeks) };
}

/**
 * An undated post as it reads once given a day, for a view showing the move
 * before the server's render does. Timed against `today` the same way
 * movePostInPeriod re-times a moved post.
 */
export function scheduleUnscheduledPost(
  post: UnscheduledPost,
  toDayKey: string,
  today: string
): ScheduledPost {
  return {
    key: post.key,
    id: post.id,
    source: post.source,
    title: post.title,
    detail: post.detail,
    status: post.status,
    stage: stageOfPost(post.status),
    date: toSheetDate(toDayKey),
    ...timingOf(post.status, toDayKey, today),
  };
}

/**
 * The period with a post that wasn't on it added to its day, as dragging one
 * out of Needs a date leaves it. A day outside the period leaves the period
 * unchanged, the same as a move past its edge.
 */
export function placePostInPeriod(period: CalendarPeriod, post: ScheduledPost): CalendarPeriod {
  const weeks = period.weeks.map((week) =>
    week.map((day) =>
      day.key === post.dayKey
        ? {
            ...day,
            posts: [...day.posts.filter((entry) => entry.key !== post.key), post].sort(comparePosts),
          }
        : day
    )
  );
  return { ...period, weeks, postCount: countInPeriod(weeks) };
}

/**
 * How many of the period's unposted posts sit at each pipeline stage.
 *
 * Padding days are left out, matching postCount: the counts describe the
 * period named in the header. Computed from the period rather than stored on
 * it, so a drag across the period's edge updates the counts as well as the grid.
 */
export function countStages(period: CalendarPeriod): Record<PipelineStage, number> {
  const counts = emptyStageCounts();
  for (const day of period.weeks.flat()) {
    if (!day.inPeriod) continue;
    for (const post of day.posts) if (post.stage) counts[post.stage] += 1;
  }
  return counts;
}

function emptyStageCounts(): Record<PipelineStage, number> {
  return Object.fromEntries(PIPELINE_STAGES.map((stage) => [stage, 0])) as Record<
    PipelineStage,
    number
  >;
}

/** How far along a status is, for the step dots on cards and list rows. */
export interface StageProgress {
  /** Dots filled: 0 before Idea, 1 for Idea through 5 for Ready and Posted. */
  filled: number;
  /** Out, rather than only ready to go out: drawn differently from Ready. */
  posted: boolean;
}

/**
 * Read from the status rather than the stage, because the stage files a deal
 * still in Discussion or In Route under Idea, and a deal with nothing agreed
 * or no product yet is not as far along as a post whose idea is written down.
 * Cancelled and Redacted never reach the calendar, and read as not started.
 */
export function stageProgress(status: WorkflowStatus): StageProgress {
  if (status === "Posted") return { filled: PIPELINE_STAGES.length, posted: true };
  const index = (PIPELINE_STAGES as WorkflowStatus[]).indexOf(status);
  return { filled: index + 1, posted: false };
}

// --- Board ----------------------------------------------------------------------

/** Where a card can be sent on the board: a stage, or out of the pipeline. */
export type BoardTarget = PipelineStage | "Posted";

export interface BoardPost {
  key: string;
  id: string;
  source: PostSource;
  title: string;
  /** "Reel" for an own post; the campaign name for a deal. */
  detail: string;
  /**
   * The record's own status, which for a deal not yet started differs from
   * its stage ("Discussion" under Idea). Shown so the column never hides the
   * word the creator actually picked.
   */
  status: WorkflowStatus;
  stage: PipelineStage;
  /** yyyy-mm-dd, or "" for work with no day yet. */
  dayKey: string;
  /** "Tomorrow", "Overdue by 2 days", or "No date". */
  label: string;
  /** Null when there is no day, so there is nothing to be early or late for. */
  state: PostState | null;
  daysAway: number | null;
  behind: boolean;
  /**
   * Whether the card can be dragged to another stage. Only the creator's own
   * posts: a deal's Idea column also holds Discussion and In Route, so a stage
   * does not map back to one status for every deal, and a deal changes stage
   * from its edit sheet, where the real status is picked.
   */
  movable: boolean;
}

export interface BoardColumn {
  stage: PipelineStage;
  posts: BoardPost[];
}

// Dated work leads, soonest first, since the day is what makes a stage
// urgent; undated work follows, by title.
function compareBoardPosts(a: BoardPost, b: BoardPost): number {
  return (
    Number(a.dayKey === "") - Number(b.dayKey === "") ||
    a.dayKey.localeCompare(b.dayKey) ||
    a.title.localeCompare(b.title)
  );
}

/**
 * Every live post from both stores, dated or not, by pipeline stage.
 *
 * Built from the two lists the page already has rather than from the stores
 * again, so the board and the grid can't disagree about what is live.
 */
export function selectBoard(
  scheduled: ScheduledPost[],
  unscheduled: UnscheduledPost[]
): BoardColumn[] {
  const posts: BoardPost[] = [
    ...scheduled
      .filter((post): post is ScheduledPost & { stage: PipelineStage } => post.stage !== null)
      .map((post) => ({
        key: post.key,
        id: post.id,
        source: post.source,
        title: post.title,
        detail: post.detail,
        status: post.status,
        stage: post.stage,
        dayKey: post.dayKey,
        label: post.label,
        state: post.state,
        daysAway: post.daysAway,
        behind: post.behind,
        movable: post.source === "own",
      })),
    ...unscheduled.map((post) => ({
      key: post.key,
      id: post.id,
      source: post.source,
      title: post.title,
      detail: post.detail,
      status: post.status,
      stage: post.stage,
      dayKey: "",
      label: "No date",
      state: null,
      daysAway: null,
      behind: false,
      movable: post.source === "own",
    })),
  ];

  return PIPELINE_STAGES.map((stage) => ({
    stage,
    posts: posts.filter((post) => post.stage === stage).sort(compareBoardPosts),
  }));
}

/**
 * The board with one of the creator's own posts sent to another stage, or off
 * the board as posted. Pure, for the same optimistic render a day move gets.
 * The warning is recomputed, so a post dragged to Ready stops reading as
 * behind before the write returns.
 */
export function movePostOnBoard(
  columns: BoardColumn[],
  postKey: string,
  target: BoardTarget
): BoardColumn[] {
  const moved = columns.flatMap((column) => column.posts).find((post) => post.key === postKey);
  if (!moved || moved.stage === target) return columns;

  const post: BoardPost | null =
    target === "Posted"
      ? null
      : {
          ...moved,
          stage: target,
          status: target,
          behind:
            moved.state !== null &&
            moved.daysAway !== null &&
            isBehind(moved.state, moved.daysAway, isProductionReady(target)),
        };

  return columns.map((column) => {
    const kept = column.posts.filter((entry) => entry.key !== postKey);
    if (post && column.stage === target) {
      return { ...column, posts: [...kept, post].sort(compareBoardPosts) };
    }
    return kept.length === column.posts.length ? column : { ...column, posts: kept };
  });
}

/**
 * The month and the week each view link should open, from whichever of the
 * two the URL names. Switching views keeps the date in view: a week opens the
 * month it mostly sits in (its Thursday's), and a month opens the week holding
 * today when today is in it, or else its first week.
 */
export function resolveCalendarAnchors(
  input: { month?: string; week?: string },
  now: Date = new Date()
): { monthKey: string; weekKey: string } {
  const today = todayKey(now);
  if (input.week && isDayKey(input.week)) {
    const weekKey = startOfWeek(input.week);
    return { weekKey, monthKey: monthKeyOf(addDays(weekKey, 3)) };
  }
  if (input.month && isMonthKey(input.month)) {
    const weekKey =
      monthKeyOf(today) === input.month ? startOfWeek(today) : startOfWeek(`${input.month}-01`);
    return { monthKey: input.month, weekKey };
  }
  return { monthKey: monthKeyOf(today), weekKey: startOfWeek(today) };
}
