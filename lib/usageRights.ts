import { addDays, addMonthsToDay, daysBetween, todayKey } from "@/lib/day";
import { toIsoDate, toSheetDate } from "@/lib/campaigns";
import type { Campaign, CampaignUsage } from "@/repositories/campaigns";

// When a brand's right to keep running the content as an ad runs out, and
// what is owed if it wants longer.
//
// The clock starts at the deal's upload date, because that is the day the ad
// exists: a licence agreed in March on a reel posted in May has not been
// running since March. Nothing here is stored as a date. An end date written
// down at agreement time goes stale the moment the post slips a week, and
// then quietly lies; deriving it from the upload date cannot.
//
// Client-safe: the dashboard card that renews a licence is a client
// component, and the pages that list them are not, and both read this.

/**
 * The longest notice a licence gets before it runs out.
 *
 * A ceiling, not a fixed window: see alertWindow below. A flat thirty days is
 * longer than a one-month term, so a short licence would be "expiring" from
 * the moment it started and could never leave the decision queue, however
 * many times it was renewed.
 */
export const USAGE_ALERT_DAYS = 30;

/**
 * How much notice this particular term earns: at most USAGE_ALERT_DAYS, and
 * never more than half of the term itself.
 *
 * Half is the point where "this is running out" stops being news. A twelve
 * month licence still warns a month ahead; a one month licence warns a
 * fortnight ahead, which is notice rather than a permanent alarm; and a
 * licence renewed today leaves the queue immediately, because a decision that
 * has just been made is not one still owed.
 */
function alertWindow(termDays: number): number {
  return Math.min(USAGE_ALERT_DAYS, Math.floor(Math.max(termDays, 0) / 2));
}

export type UsageState =
  /** No term was ever recorded on this deal. */
  | "untracked"
  /** A term is recorded, but the post it counts from has not gone up yet. */
  | "unstarted"
  | "active"
  /** Inside USAGE_ALERT_DAYS of running out: the decision window. */
  | "expiring"
  | "expired"
  /** The countdown is frozen; the brand stopped running it. */
  | "paused"
  /** Called off outright, whether or not the term had run out. */
  | "ended";

export interface UsageTerm {
  state: UsageState;
  /** yyyy-mm-dd the current term runs from, "" when there is nothing to count. */
  startDayKey: string;
  /** yyyy-mm-dd it runs out, with paused days already added back. */
  endDayKey: string;
  /** DD/MM/YYYY, the same day in the app's stored format. */
  endDate: string;
  /** Whole days until it runs out; negative once past, frozen while paused. */
  daysRemaining: number;
  /** Every month ever granted on this deal: the base term plus each renewal. */
  totalMonths: number;
  /** 1 for the original licence, plus one per renewal. */
  termCount: number;
  /** Renewal money already collected. */
  renewalReceived: number;
  /** Renewal money agreed and still owed. */
  renewalPending: number;
  label: string; // "Expires in 12 days", "Expired 4 days ago", "Paused, 12 days left"
}

const UNTRACKED: UsageTerm = {
  state: "untracked",
  startDayKey: "",
  endDayKey: "",
  endDate: "",
  daysRemaining: 0,
  totalMonths: 0,
  termCount: 0,
  renewalReceived: 0,
  renewalPending: 0,
  label: "Not tracked",
};

function renewalMoney(usage: CampaignUsage): { received: number; pending: number } {
  let received = 0;
  let pending = 0;
  for (const renewal of usage.renewals) {
    if (renewal.paymentStatus === "received") received += renewal.amount;
    else if (renewal.paymentStatus === "pending") pending += renewal.amount;
  }
  return { received, pending };
}

function termLabel(state: UsageState, daysRemaining: number, endedOn: string): string {
  switch (state) {
    case "untracked":
      return "Not tracked";
    case "unstarted":
      return "Starts when this posts";
    case "ended":
      return endedOn ? `Ended ${endedOn}` : "Ended";
    case "paused": {
      if (daysRemaining < 0) return "Paused, already past its term";
      return `Paused, ${daysRemaining} day${daysRemaining === 1 ? "" : "s"} left`;
    }
    case "expired": {
      const days = Math.abs(daysRemaining);
      return `Expired ${days} day${days === 1 ? "" : "s"} ago`;
    }
    default:
      if (daysRemaining === 0) return "Expires today";
      if (daysRemaining === 1) return "Expires tomorrow";
      return `Expires in ${daysRemaining} days`;
  }
}

/**
 * Where a deal's usage licence currently stands.
 *
 * The term being counted is the most recent one: the last renewal if there
 * has been one, otherwise the original. A renewal carries its own start date
 * rather than being assumed to begin where the previous term ended, because
 * they regularly are not agreed until after the licence has already lapsed,
 * and pretending otherwise would have the new term expiring in the past.
 *
 * Paused days are added back onto the end date, which is what freezes
 * `daysRemaining` for as long as the pause lasts: a licence the brand is not
 * running is not being spent.
 */
export function usageTerm(campaign: Campaign, now: Date = new Date()): UsageTerm {
  const usage = campaign.usage;
  if (usage.months <= 0 && usage.renewals.length === 0) return UNTRACKED;

  const money = renewalMoney(usage);
  const totalMonths = usage.renewals.reduce((sum, r) => sum + r.months, usage.months);
  const base: UsageTerm = {
    ...UNTRACKED,
    totalMonths,
    termCount: 1 + usage.renewals.length,
    renewalReceived: money.received,
    renewalPending: money.pending,
  };

  const uploadKey = toIsoDate(campaign.uploadDate);
  if (uploadKey === "") {
    return { ...base, state: "unstarted", label: termLabel("unstarted", 0, "") };
  }

  const latest = usage.renewals[usage.renewals.length - 1];
  const startDayKey = latest ? toIsoDate(latest.startDate) || uploadKey : uploadKey;
  const months = latest ? latest.months : usage.months;

  const today = todayKey(now);
  const nominalEnd = addMonthsToDay(startDayKey, months);
  // While paused, the pause itself keeps lengthening, so the end date slides
  // forward day for day and daysRemaining holds still. Banked pauses are
  // already in pausedDays; this only adds the one still running.
  const pausedSoFar =
    usage.status === "paused" && toIsoDate(usage.pausedOn) !== ""
      ? daysBetween(toIsoDate(usage.pausedOn), today)
      : 0;
  const endDayKey = addDays(nominalEnd, usage.pausedDays + Math.max(pausedSoFar, 0));
  const daysRemaining = daysBetween(today, endDayKey);
  // Measured on the nominal term, not the paused-extended one: pausing a
  // licence should not also widen the window it warns in.
  const window = alertWindow(daysBetween(startDayKey, nominalEnd));

  const state: UsageState =
    usage.status === "ended"
      ? "ended"
      : usage.status === "paused"
        ? "paused"
        : daysRemaining < 0
          ? "expired"
          : daysRemaining <= window
            ? "expiring"
            : "active";

  return {
    ...base,
    state,
    startDayKey,
    endDayKey,
    endDate: toSheetDate(endDayKey),
    daysRemaining,
    label: termLabel(state, daysRemaining, usage.endedOn),
  };
}

export interface UsageAlert {
  campaignId: string;
  brand: string;
  campaign: string;
  /** The deal's own value, for ranking a list of decisions by what is at stake. */
  amount: number;
  term: UsageTerm;
}

// A deal that was called off never granted anything. "Redacted" is the
// sheet's own word for a row written out of the record; both are dropped
// here, matching selectDuePayments, selectAttentionItems and the calendar.
const DROPPED_STATUSES = new Set(["cancelled", "redacted"]);

/**
 * Licences at the point where a decision is owed: inside the alert window, or
 * already past their term and never closed off.
 *
 * Paused and ended licences are absent by construction, which is the whole
 * point of those two states: they are the answers to this list, so choosing
 * one takes the deal out of it. Soonest first, and the most valuable deal
 * first among licences running out on the same day.
 */
export function selectExpiringUsage(campaigns: Campaign[], now: Date = new Date()): UsageAlert[] {
  return campaigns
    .filter((campaign) => !DROPPED_STATUSES.has(campaign.status.trim().toLowerCase()))
    .map((campaign) => ({
      campaignId: campaign.id,
      brand: campaign.brand,
      campaign: campaign.campaign,
      amount: campaign.total,
      term: usageTerm(campaign, now),
    }))
    .filter((alert) => alert.term.state === "expiring" || alert.term.state === "expired")
    .sort(
      (a, b) => a.term.daysRemaining - b.term.daysRemaining || b.amount - a.amount
    );
}

/**
 * The day a renewal agreed today would sensibly run from: the day after the
 * current term ends, or today when that has already passed.
 *
 * A gap between the old term and the new one is a stretch of time the brand
 * was running an ad it had no licence for, so the default closes it; a term
 * that lapsed weeks ago is not backdated, because the renewal is being bought
 * now and the creator can move the date if it really was retroactive.
 */
export function defaultRenewalStart(term: UsageTerm, now: Date = new Date()): string {
  const today = todayKey(now);
  if (term.endDayKey === "") return today;
  const next = addDays(term.endDayKey, 1);
  return next > today ? next : today;
}

export interface OwedRenewal {
  campaignId: string;
  renewalId: string;
  brand: string;
  campaign: string;
  amount: number;
  months: number;
  /** DD/MM/YYYY it was agreed to be paid by, or "" when nothing was agreed. */
  paymentDue: string;
  /** Whole days until it is due; negative once overdue, null when undated. */
  daysUntilDue: number | null;
  overdue: boolean;
}

/**
 * Renewal fees agreed and not yet collected.
 *
 * The other half of the renewal loop, and the half that would otherwise go
 * missing: agreeing a renewal takes the deal out of selectExpiringUsage, so
 * without this the money it brought in would be recorded once and never
 * chased. It is deliberately not folded into selectDuePayments, which reads
 * BrandCampaignRecord and answers for the deal itself: a deal can be paid in
 * full while the licence extension against it is still owed, and one row
 * cannot say both.
 *
 * Most overdue first, undated fees last: there is nothing to say how late
 * those are.
 */
export function selectOwedRenewals(campaigns: Campaign[], now: Date = new Date()): OwedRenewal[] {
  const today = todayKey(now);
  const owed: OwedRenewal[] = [];

  for (const campaign of campaigns) {
    if (DROPPED_STATUSES.has(campaign.status.trim().toLowerCase())) continue;
    for (const renewal of campaign.usage.renewals) {
      if (renewal.paymentStatus !== "pending" || renewal.amount <= 0) continue;

      const dueKey = toIsoDate(renewal.paymentDue);
      const daysUntilDue = dueKey === "" ? null : daysBetween(today, dueKey);
      owed.push({
        campaignId: campaign.id,
        renewalId: renewal.id,
        brand: campaign.brand,
        campaign: campaign.campaign,
        amount: renewal.amount,
        months: renewal.months,
        paymentDue: renewal.paymentDue,
        daysUntilDue,
        overdue: daysUntilDue !== null && daysUntilDue < 0,
      });
    }
  }

  return owed.sort(
    (a, b) => (a.daysUntilDue ?? Number.POSITIVE_INFINITY) - (b.daysUntilDue ?? Number.POSITIVE_INFINITY)
  );
}
