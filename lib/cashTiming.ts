import { daysBetween, monthKeyOf } from "@/lib/day";
import { isCampaignCalledOff, toIsoDate } from "@/lib/campaigns";
import { currentMonthKey } from "@/lib/earnings";
import type { Campaign, CampaignPaymentStatus } from "@/repositories/campaigns";

// When money arrives, as opposed to whether it arrives on time.
//
// lib/paymentReliability.ts already scores a payment against the date it was
// promised for, which is a fact about the brand. This is the other question,
// which is a fact about the creator's cash: how long after posting the money
// actually shows up, and how much of it is booked to show up next. The
// dashboard had per-deal timers and no aggregate of either.
//
// Client-safe and injectable on `now`, the same shape selectDuePayments and
// paymentTiming use, so a server render and a test are not at the mercy of
// the wall clock.

/**
 * The fields a collection-lag read needs, common to Campaign and
 * BrandCampaignRecord.
 *
 * Structural for the same reason PaymentTimingSource is: the dashboard's
 * payments card already holds the brand-CRM projection and should not fetch
 * the campaign records a second time to learn one number about them.
 */
export interface CollectionTimingSource {
  status: string;
  /** The cash half. A barter parcel has no collection to be waiting on. */
  amount: number;
  paymentStatus: CampaignPaymentStatus;
  uploadDate: string; // DD/MM/YYYY
  paidDate: string; // DD/MM/YYYY
}

export interface CollectionLag {
  /** Deals carrying both a posting date and a landing date. */
  sample: number;
  averageDays: number | null;
  /** The typical deal rather than the mean, which one slow brand can drag. */
  medianDays: number | null;
  fastestDays: number | null;
  slowestDays: number | null;
}

const NO_LAG: CollectionLag = {
  sample: 0,
  averageDays: null,
  medianDays: null,
  fastestDays: null,
  slowestDays: null,
};

function median(sorted: number[]): number {
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

/**
 * How long after posting the money lands, across every deal that has both
 * dates on it.
 *
 * Measured from uploadDate, not from the deal date: the creator's side of the
 * bargain is discharged when the post goes up, and the wait that matters is
 * the one that starts there. Cash deals only, for the reason
 * PaymentTimingSource spells out at length: a barter deal owes a parcel, not
 * money, and a parcel arrives when it arrives.
 *
 * A negative lag is possible and kept, because a brand paying up front is a
 * real and useful thing to see rather than a data error to clamp away.
 *
 * Everything is null below a sample of one, so a book that has never recorded
 * a landing date says nothing instead of saying zero days.
 */
export function computeCollectionLag(records: CollectionTimingSource[]): CollectionLag {
  const lags: number[] = [];

  for (const campaign of records) {
    if (isCampaignCalledOff(campaign.status)) continue;
    if (campaign.paymentStatus !== "received") continue;
    if (campaign.amount <= 0) continue;

    const postedKey = toIsoDate(campaign.uploadDate);
    const paidKey = toIsoDate(campaign.paidDate);
    if (postedKey === "" || paidKey === "") continue;

    lags.push(daysBetween(postedKey, paidKey));
  }

  if (lags.length === 0) return NO_LAG;

  lags.sort((a, b) => a - b);
  const sum = lags.reduce((total, days) => total + days, 0);
  return {
    sample: lags.length,
    averageDays: Math.round(sum / lags.length),
    medianDays: median(lags),
    fastestDays: lags[0],
    slowestDays: lags[lags.length - 1],
  };
}

export interface MonthForecast {
  month: string; // "YYYY-MM"
  /** What has actually landed this month, as the earnings tiles report it. */
  received: number;
  /** Pending value whose due date falls in this month. */
  expected: number;
  forecast: number;
  /** Pending deals and renewals making up `expected`. */
  sources: number;
}

/**
 * The month in progress, finished out.
 *
 * The earnings tiles report actuals, which for a book paid weeks in arrears
 * means the current month reads near-empty for most of its length by
 * construction: computeMonthTrend documents that at length and refuses to
 * compare against it for exactly this reason. This is the other half of that
 * argument. Actuals plus what is contractually due before the month is out is
 * a number the month can be judged on while it is still running.
 *
 * Total rather than cash, because it forecasts the Received tile it sits
 * under, and that tile counts barter. projectCashIn above is the cash read.
 *
 * A payment due earlier this month and still unpaid is counted: it was booked
 * for this month and dropping it would forecast a month that assumes its own
 * overdue debts vanish. One due last month is not, because it belongs to the
 * month that booked it.
 */
export function computeMonthForecast(
  campaigns: Campaign[],
  received: number,
  now: Date = new Date()
): MonthForecast {
  const month = currentMonthKey(now);
  let expected = 0;
  let sources = 0;

  const countDue = (due: string, amount: number) => {
    if (amount <= 0) return;
    const dueKey = toIsoDate(due);
    if (dueKey === "" || monthKeyOf(dueKey) !== month) return;
    expected += amount;
    sources += 1;
  };

  for (const campaign of campaigns) {
    if (isCampaignCalledOff(campaign.status)) continue;

    if (campaign.paymentStatus === "pending") {
      countDue(campaign.paymentDue, campaign.total);
    }
    for (const renewal of campaign.usage.renewals) {
      if (renewal.paymentStatus !== "pending") continue;
      countDue(renewal.paymentDue, renewal.amount);
    }
  }

  return { month, received, expected, forecast: received + expected, sources };
}
