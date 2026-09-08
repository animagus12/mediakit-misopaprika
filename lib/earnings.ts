import { addMonths, monthKeyOf, todayKey } from "@/lib/day";
import type { MonthlyEarnings } from "@/repositories/earnings";

export function monthLabel(month: string): string {
  const [year, monthNum] = month.split("-");
  const date = new Date(Number(year), Number(monthNum) - 1, 1);
  return date.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

// "YYYY-MM", in the reader's zone rather than the server's.
//
// This used to be `toISOString().slice(0, 7)`, which is UTC: for the first
// five and a half hours of every month, IST is already into the new month
// while UTC is still in the old one, so the dashboard highlighted the wrong
// row and the trend compared the wrong pair. lib/day.ts pins the zone once.
export function currentMonthKey(now: Date = new Date()): string {
  return monthKeyOf(todayKey(now));
}

// "YYYY-MM" strings compare chronologically as plain strings.
export function monthsAgoKey(count: number, now: Date = new Date()): string {
  return addMonths(currentMonthKey(now), -count);
}

function monthlyTotal(monthly: MonthlyEarnings[], key: string): number {
  return monthly.find((m) => m.month === key)?.total ?? 0;
}

export interface MonthTrend {
  /** Signed percentage change between the two months named in `label`. */
  percent: number;
  /** Which two months were actually compared, e.g. "Aug vs Jul". */
  label: string;
}

// Just the month, for a label that has to name a comparison in four
// characters. Anchored at UTC midnight and formatted in UTC, so the key maps
// to exactly one month regardless of where this renders.
const MONTH_ONLY = new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "UTC" });

function monthOnly(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return MONTH_ONLY.format(new Date(Date.UTC(year, month - 1, 1)));
}

/**
 * Month-over-month change across the last two *complete* months.
 *
 * Deliberately not "this month vs last month". A month's figure here counts
 * only money actually received (see repositories/earnings.ts: a pending deal
 * lands in `pending`, never in `total`), and payment arrives weeks after the
 * deal is delivered. The current month's bucket is therefore near-empty for
 * most of the month by construction, and comparing it to a finished month
 * read "100% down" almost permanently: it did, on every day of this month.
 * Comparing part of a month to all of one is not a comparison anyway.
 *
 * The trade is that this says nothing about the month in progress, which is
 * honest: a metric that lags by weeks cannot judge a week-old month. The
 * label names the pair so the tile never has to be taken on trust.
 *
 * null when the earlier of the two months earned nothing, so callers hide the
 * trend rather than show a divide-by-zero, and null when there is no data.
 */
export function computeMonthTrend(
  monthly: MonthlyEarnings[],
  now: Date = new Date()
): MonthTrend | null {
  const latestKey = monthsAgoKey(1, now);
  const priorKey = monthsAgoKey(2, now);
  const prior = monthlyTotal(monthly, priorKey);
  if (prior <= 0) return null;

  const latest = monthlyTotal(monthly, latestKey);
  return {
    percent: ((latest - prior) / prior) * 100,
    label: `${monthOnly(latestKey)} vs ${monthOnly(priorKey)}`,
  };
}

export interface MonthMargin {
  month: string; // "YYYY-MM"
  /** Cash received that month. Never the total: an editor cannot be paid in barter. */
  cash: number;
  editorCost: number;
  margin: number;
  /** margin as a share of cash; null when nothing came in to take a share of. */
  marginPercent: number | null;
}

/**
 * Cash received each month, net of what the editing cost.
 *
 * The dashboard reported gross income and, separately, running payout totals,
 * which leaves "earned" reading as "kept" on every month where a share of it
 * was always going out again. Netting the two is the whole of this.
 *
 * Cash, not Total: barter cannot pay an editor, so counting a parcel toward
 * the income a cash cost is subtracted from would report a margin the creator
 * cannot spend. It is the same reason computeEditorPayouts exists at all.
 *
 * A month with no editing recorded nets to its cash rather than being dropped.
 * That is the honest reading, since nothing was spent, and it keeps the series
 * defined across the whole window instead of leaving holes wherever the
 * creator cut a month's videos themselves. `marginPercent` stays null in that
 * case only when no cash came in either, so a caller can tell "kept all of it"
 * apart from "there was nothing to keep".
 *
 * Order follows `monthly`, which is newest-first.
 */
export function computeMarginSeries(
  monthly: MonthlyEarnings[],
  editorCostByMonth: Map<string, number>
): MonthMargin[] {
  return monthly.map((month) => {
    const editorCost = editorCostByMonth.get(month.month) ?? 0;
    const margin = month.paid - editorCost;
    return {
      month: month.month,
      cash: month.paid,
      editorCost,
      margin,
      marginPercent: month.paid > 0 ? (margin / month.paid) * 100 : null,
    };
  });
}
