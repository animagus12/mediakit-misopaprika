import { daysBetween, todayKey } from "@/lib/day";
import { toIsoDate } from "@/lib/campaigns";
import type { CampaignPaymentStatus } from "@/repositories/campaigns";

// How well a brand keeps to the dates it agrees to.
//
// The app already knew when a payment was *due* and whether it had arrived.
// What it could not answer is the question that actually decides whether to
// take the next deal: does this brand pay when it says it will. That needs
// the day the money landed, which CampaignRecord.paidDate now carries, and
// the gap between the two dates is the whole of the evidence.
//
// Client-safe and structurally typed on its input, so both Campaign (the
// /campaigns table) and BrandCampaignRecord (the brand CRM) can be passed
// without either importing the other's server-only repository: the same split
// lib/brandCampaignStats.ts already makes.

/** The fields a reliability read needs, common to Campaign and BrandCampaignRecord. */
export interface PaymentTimingSource {
  status: string; // pipeline status, so cancelled deals can be dropped
  amount: number;
  paymentStatus: CampaignPaymentStatus;
  paymentDue: string; // DD/MM/YYYY
  paidDate: string; // DD/MM/YYYY
}

export type PaymentPunctuality =
  | "early"
  | "on-time"
  | "late"
  /** Still unpaid and already past its due date: the sharpest signal there is. */
  | "overdue"
  /** Unpaid, but not yet due. */
  | "waiting"
  /** No due date, no paid date: nothing to measure. */
  | "untimed";

export interface PaymentTiming {
  punctuality: PaymentPunctuality;
  /**
   * Whole days between the day it was due and the day it landed. Negative
   * when it came early; null when one of the two dates is missing.
   *
   * For a payment that has not arrived this measures against today instead,
   * so a brand that simply never pays is not read as having no track record.
   */
  delayDays: number | null;
  label: string; // "On time", "8 days late", "3 days early", "12 days overdue"
}

const UNTIMED: PaymentTiming = { punctuality: "untimed", delayDays: null, label: "" };

function dayLabel(days: number, suffix: string): string {
  return `${days} day${days === 1 ? "" : "s"} ${suffix}`;
}

/**
 * What one payment did against the date it was promised for.
 *
 * `now` is injectable so a server render and a test are not at the mercy of
 * the wall clock, the same shape selectDuePayments uses.
 */
export function paymentTiming(record: PaymentTimingSource, now: Date = new Date()): PaymentTiming {
  const dueKey = toIsoDate(record.paymentDue);
  if (dueKey === "") return UNTIMED;

  if (record.paymentStatus === "received") {
    const paidKey = toIsoDate(record.paidDate);
    // Received, but nobody wrote down when. The deal is settled and simply has
    // nothing to say about punctuality: counting it as on time would be
    // inventing evidence, and counting it as late would be worse.
    if (paidKey === "") return UNTIMED;

    const delayDays = daysBetween(dueKey, paidKey);
    if (delayDays > 0) {
      return { punctuality: "late", delayDays, label: dayLabel(delayDays, "late") };
    }
    if (delayDays < 0) {
      return { punctuality: "early", delayDays, label: dayLabel(-delayDays, "early") };
    }
    return { punctuality: "on-time", delayDays: 0, label: "On time" };
  }

  if (record.paymentStatus !== "pending") return UNTIMED;

  const delayDays = daysBetween(dueKey, todayKey(now));
  if (delayDays > 0) {
    return { punctuality: "overdue", delayDays, label: dayLabel(delayDays, "overdue") };
  }
  return { punctuality: "waiting", delayDays, label: "Not due yet" };
}

export type ReliabilityRating =
  | "reliable"
  | "mostly-reliable"
  | "slow"
  | "unreliable"
  /** Too little history to say anything honest. */
  | "unrated";

export interface PaymentReliability {
  /** Payments carrying both a due date and a landing date. */
  settled: number;
  /** Payments still unpaid and already past due. */
  overdue: number;
  /** Payments counted toward the score: settled + overdue. */
  sample: number;
  onTime: number; // settled on or before the due date
  late: number; // settled after it
  /** Mean signed delay across settled payments; negative when typically early. */
  averageDelayDays: number | null;
  /** Mean lateness across the whole sample, floored at zero per payment. */
  typicalDelayDays: number | null;
  worstDelayDays: number | null;
  /** Money still owed past its due date. */
  overdueAmount: number;
  /** 0-100, or null below MIN_RELIABILITY_SAMPLE. See the weighting below. */
  score: number | null;
  rating: ReliabilityRating;
  label: string; // "Pays on time", "Runs 9 days late on average"
}

/**
 * One payment is an anecdote. Below this the rating stays "unrated" and the
 * UI says how thin the record is rather than dressing it up as a verdict.
 */
export const MIN_RELIABILITY_SAMPLE = 2;

/** Lateness at which promptness scores zero: a month late is as bad as it gets. */
const MAX_PENALTY_DAYS = 30;

export const EMPTY_RELIABILITY: PaymentReliability = {
  settled: 0,
  overdue: 0,
  sample: 0,
  onTime: 0,
  late: 0,
  averageDelayDays: null,
  typicalDelayDays: null,
  worstDelayDays: null,
  overdueAmount: 0,
  score: null,
  rating: "unrated",
  label: "No payment history",
};

function ratingOf(score: number): ReliabilityRating {
  if (score >= 90) return "reliable";
  if (score >= 70) return "mostly-reliable";
  if (score >= 45) return "slow";
  return "unreliable";
}

function reliabilityLabel(
  rating: ReliabilityRating,
  sample: number,
  typicalDelayDays: number,
  overdue: number
): string {
  if (rating === "unrated") {
    return sample === 0 ? "No payment history" : "Only one payment on record";
  }
  // An open overdue payment outranks any average: it is the one thing here
  // that is still happening rather than already over.
  if (overdue > 0) {
    return `${overdue} payment${overdue === 1 ? "" : "s"} still overdue`;
  }
  if (typicalDelayDays < 1) return "Pays on time";
  return `Runs ${typicalDelayDays} day${typicalDelayDays === 1 ? "" : "s"} late on average`;
}

/**
 * A brand's payment track record across its deals.
 *
 * The score is 60% how often they paid on time and 40% how late they are when
 * they do not, because a number nobody can explain is a number nobody should
 * act on. The split is deliberate: a brand four days late every single time is
 * a different problem from one that pays instantly nine times and then
 * disappears for two months, and a pure on-time rate calls those identical.
 * Paying early earns no bonus over paying on time, since money arriving before
 * it was promised is pleasant rather than more trustworthy.
 *
 * Payments still outstanding past their due date are counted, not just settled
 * ones. Scoring only what has been paid would hand a brand that has never paid
 * at all a perfect record, which is exactly backwards: the deals it has gone
 * quiet on are the evidence.
 *
 * Cancelled deals and barter-only ones are dropped: nothing was owed on a
 * schedule, so nothing about them says whether a schedule is kept. The same
 * exclusions selectDuePayments and selectAttentionItems make.
 */
export function computePaymentReliability(
  records: PaymentTimingSource[],
  now: Date = new Date()
): PaymentReliability {
  const stats: PaymentReliability = { ...EMPTY_RELIABILITY };
  const settledDelays: number[] = [];
  const lateness: number[] = [];

  for (const record of records) {
    if (record.status.trim().toLowerCase() === "cancelled") continue;
    if (record.amount <= 0) continue;

    const timing = paymentTiming(record, now);
    if (timing.delayDays === null) continue;

    if (timing.punctuality === "overdue") {
      stats.overdue += 1;
      stats.overdueAmount += record.amount;
      lateness.push(timing.delayDays);
      continue;
    }
    if (timing.punctuality === "waiting") continue;

    stats.settled += 1;
    settledDelays.push(timing.delayDays);
    lateness.push(Math.max(timing.delayDays, 0));
    if (timing.punctuality === "late") stats.late += 1;
    else stats.onTime += 1;
  }

  stats.sample = stats.settled + stats.overdue;
  if (stats.sample === 0) return stats;

  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  if (settledDelays.length > 0) stats.averageDelayDays = Math.round(mean(settledDelays));
  stats.typicalDelayDays = Math.round(mean(lateness));
  stats.worstDelayDays = Math.max(...lateness);

  const lateCount = stats.late + stats.overdue;
  const onTimeRate = (stats.sample - lateCount) / stats.sample;
  const promptness = 1 - Math.min(mean(lateness), MAX_PENALTY_DAYS) / MAX_PENALTY_DAYS;

  if (stats.sample >= MIN_RELIABILITY_SAMPLE) {
    stats.score = Math.round(100 * (0.6 * onTimeRate + 0.4 * promptness));
    stats.rating = ratingOf(stats.score);
  }
  stats.label = reliabilityLabel(stats.rating, stats.sample, stats.typicalDelayDays, stats.overdue);
  return stats;
}

export const RELIABILITY_RATING_LABELS: Record<ReliabilityRating, string> = {
  reliable: "Reliable payer",
  "mostly-reliable": "Mostly on time",
  slow: "Slow payer",
  unreliable: "Unreliable payer",
  unrated: "Not enough history",
};
