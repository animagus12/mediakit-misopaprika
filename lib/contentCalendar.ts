import {
  addDays,
  addMonths,
  dayKeyOf,
  daysBetween,
  daysInMonth,
  formatMonthLabel,
  isMonthKey,
  monthKeyOf,
  todayKey,
  weekdayIndex,
} from "@/lib/day";
import { toIsoDate } from "@/lib/campaigns";
import { isProductionReady, contentLabel } from "@/lib/contentPlan";
import { formatMoney } from "@/lib/invoice";
import type { Campaign } from "@/repositories/campaigns";
import type { ContentItem } from "@/repositories/contentPlan";

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
// cases, not by a second date field (see postState below).
//
// Client-safe on purpose: the page is a server component, but the controls
// that schedule and edit are not, and both render the same rows.

/** How many days ahead still counts as "this week" for the reminder list. */
export const WEEK_AHEAD_DAYS = 7;

// How close a posting day has to be before work that has not been finished is
// worth warning about. Two days is the point at which "I still have to shoot
// this" stops being a plan and starts being a problem.
const BEHIND_DAYS = 2;

// Deals that were called off never belonged on a schedule. "Redacted" is the
// sheet's own word for a row written out of the record; both are dropped
// everywhere here, matching selectDuePayments and selectAttentionItems.
const DROPPED_CAMPAIGN_STATUSES = new Set(["cancelled", "redacted"]);
const POSTED_CAMPAIGN_STATUS = "completed";
// Campaign.status is an open string, so this is a lookup rather than a type:
// a status nobody recognises counts as not ready, which is the safe direction
// for a warning.
const READY_CAMPAIGN_STATUSES = new Set(["ready to upload", "completed"]);
const NO_STORY = "none";

export type PostState = "posted" | "overdue" | "due" | "upcoming";

/** Which store a row came from. Decides where an edit or a schedule is sent. */
export type PostSource = "campaign" | "own";

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
  /** The pipeline stage, shown as-is: "Ready to Upload", "Filming". */
  status: string;
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
  status: string;
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

function scheduledFromCampaign(campaign: Campaign, today: string): ScheduledPost | null {
  if (DROPPED_CAMPAIGN_STATUSES.has(normalized(campaign.status))) return null;
  const dayKey = toIsoDate(campaign.uploadDate);
  // toIsoDate answers "" for a blank or malformed date; both mean the deal has
  // no day to sit on, and the unscheduled list picks it up instead.
  if (dayKey === "") return null;

  const daysAway = daysBetween(today, dayKey);
  const state = stateOf(normalized(campaign.status) === POSTED_CAMPAIGN_STATUS, daysAway);
  return {
    key: `campaign:${campaign.id}`,
    id: campaign.id,
    source: "campaign",
    title: campaign.brand.trim() || campaign.campaign.trim() || "Untitled deal",
    detail: joinDetail([campaign.campaign, deliverablesLabel(campaign)]),
    status: campaign.status,
    dayKey,
    date: campaign.uploadDate,
    state,
    daysAway,
    label: postLabel(state, daysAway),
    behind: isBehind(state, daysAway, READY_CAMPAIGN_STATUSES.has(normalized(campaign.status))),
  };
}

function scheduledFromContent(item: ContentItem, today: string): ScheduledPost | null {
  if (item.status === "Dropped") return null;
  const dayKey = toIsoDate(item.postDate);
  if (dayKey === "") return null;

  const daysAway = daysBetween(today, dayKey);
  const state = stateOf(item.status === "Posted", daysAway);
  return {
    key: `own:${item.id}`,
    id: item.id,
    source: "own",
    title: contentLabel(item.title),
    detail: item.format,
    status: item.status,
    dayKey,
    date: item.postDate,
    state,
    daysAway,
    label: postLabel(state, daysAway),
    behind: isBehind(state, daysAway, isProductionReady(item.status)),
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

  // Within a day, brand deals lead: they are the ones with a counterparty
  // waiting on them. Title breaks the remaining ties so the order is stable
  // between renders rather than following whatever the stores happened to
  // return.
  return posts.sort(
    (a, b) =>
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
 * NeedsAttentionCard is where those already surface; a Posted or Dropped idea
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

export interface CalendarDay {
  key: string; // yyyy-mm-dd
  dayOfMonth: number;
  /** False for the leading/trailing days that square the grid off. */
  inMonth: boolean;
  isToday: boolean;
  posts: ScheduledPost[];
}

export interface CalendarMonth {
  key: string; // yyyy-mm
  label: string; // "September 2026"
  previousKey: string;
  nextKey: string;
  weeks: CalendarDay[][];
  /** Posts landing inside this month, not in the padding days. */
  postCount: number;
}

/** Falls back to the month containing `now` for an absent or malformed param. */
export function resolveMonthKey(value: string | undefined, now: Date = new Date()): string {
  return value && isMonthKey(value) ? value : monthKeyOf(todayKey(now));
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
): CalendarMonth {
  const today = todayKey(now);
  const byDay = new Map<string, ScheduledPost[]>();
  for (const post of posts) {
    const existing = byDay.get(post.dayKey);
    if (existing) existing.push(post);
    else byDay.set(post.dayKey, [post]);
  }

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
      inMonth: monthKeyOf(key) === monthKey,
      isToday: key === today,
      posts: byDay.get(key) ?? [],
    });
  }

  return {
    key: monthKey,
    label: formatMonthLabel(monthKey),
    previousKey: addMonths(monthKey, -1),
    nextKey: addMonths(monthKey, 1),
    weeks,
    postCount: monthDays.reduce((sum, key) => sum + (byDay.get(key)?.length ?? 0), 0),
  };
}
