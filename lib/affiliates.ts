import { parseSheetDate } from "@/lib/editorTransactions";
import type { AffiliatePartner, PayoutSchedule } from "@/repositories/affiliatePartners";
import type { AffiliatePayout } from "@/repositories/affiliatePayouts";

// Everything the affiliate feature derives, as pure functions over the two
// stores plus the click counters the /links page already keeps.
//
// Client-safe (no "server-only"): the tables and cards that render these are
// components, and the split follows lib/editorTransactions.ts, which does the
// same job for the editor workspace.

export const AFFILIATE_STATUS_LABELS: Record<AffiliatePartner["status"], string> = {
  active: "Active",
  paused: "Paused",
  ended: "Ended",
};

export const PAYOUT_SCHEDULE_LABELS: Record<PayoutSchedule, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  "on-request": "On request",
};

/**
 * What the program's own terms say this period should have paid.
 *
 * A check on the figure typed in from the brand's portal, never a replacement
 * for it: AffiliatePayout.commissionAmount is what the brand actually said,
 * and brands net off returns and cancelled orders before they pay. A gap
 * between the two is a question to ask the brand, which is exactly why the
 * expected figure is worth computing at all.
 *
 * null when the terms cannot produce a number, so a caller shows nothing
 * rather than a confident zero.
 */
export function expectedCommission(
  partner: AffiliatePartner,
  payout: Pick<AffiliatePayout, "grossSales" | "salesCount">
): number | null {
  if (partner.commissionRate <= 0) return null;
  if (partner.commissionModel === "percent") {
    if (payout.grossSales <= 0) return null;
    return (payout.grossSales * partner.commissionRate) / 100;
  }
  if (payout.salesCount <= 0) return null;
  return payout.salesCount * partner.commissionRate;
}

/**
 * How far the reported commission sits from the expected one, as a share of
 * expected. null when there is nothing to compare against.
 *
 * Signed: negative means the brand paid less than its own terms imply, which
 * is the direction worth noticing.
 */
export function commissionVariancePercent(
  partner: AffiliatePartner,
  payout: Pick<AffiliatePayout, "grossSales" | "salesCount" | "commissionAmount">
): number | null {
  const expected = expectedCommission(partner, payout);
  if (expected === null || expected <= 0) return null;
  return ((payout.commissionAmount - expected) / expected) * 100;
}

// How long after a period closes the money is actually expected, per schedule.
// Brands settle in arrears and none of them settle on the closing day, so a
// payout is not "late" the moment its period ends. These are the windows the
// portals themselves advertise; "on-request" has no window by definition,
// which is why it is absent rather than large.
const SETTLEMENT_DAYS: Partial<Record<PayoutSchedule, number>> = {
  monthly: 30,
  quarterly: 45,
};

/**
 * When an unpaid payout should have arrived, as a timestamp. NaN when the
 * schedule makes no promise ("on-request") or the period end is unparsable,
 * which callers treat as "never late" rather than "late now".
 */
export function expectedArrival(partner: AffiliatePartner, payout: AffiliatePayout): number {
  const days = SETTLEMENT_DAYS[partner.payoutSchedule];
  if (days === undefined) return Number.NaN;
  const end = parseSheetDate(payout.periodEnd);
  if (Number.isNaN(end)) return Number.NaN;
  return end + days * 86_400_000;
}

/** Days past the expected arrival, or 0 when it is not yet due or has no date. */
export function daysOverdue(
  partner: AffiliatePartner,
  payout: AffiliatePayout,
  now: Date = new Date()
): number {
  if (payout.paymentStatus === "received") return 0;
  const due = expectedArrival(partner, payout);
  if (Number.isNaN(due)) return 0;
  const overdue = Math.floor((now.getTime() - due) / 86_400_000);
  return overdue > 0 ? overdue : 0;
}

export interface PartnerPerformance {
  partner: AffiliatePartner;
  payouts: AffiliatePayout[];
  /** Commission actually received, lifetime. */
  received: number;
  /** Commission reported but not yet paid. */
  pending: number;
  grossSales: number;
  salesCount: number;
  /**
   * Clicks on the linked /links card, lifetime. 0 when no card is linked or
   * the card has never been clicked: see LinksAnalytics on why zero is a real
   * answer here rather than "unknown".
   */
  clicks: number;
  /**
   * Sales as a percentage of clicks, or null without both.
   *
   * Lifetime against lifetime, and that is a real limitation worth stating:
   * the click counter is a single running total per item with no period
   * breakdown, so this cannot be computed for one payout period. It answers
   * "how well does this code convert overall", not "how did it convert in
   * March". Comparing periods needs per-period click counts, which the
   * counters would have to start keeping first.
   */
  conversionPercent: number | null;
  /** Commission received per click: what sending someone to this code is worth. */
  earningsPerClick: number | null;
  /** Average commission per recorded sale. */
  commissionPerSale: number | null;
}

/**
 * One partner's whole record, folded together.
 *
 * `clicks` comes in rather than being looked up, so this stays a pure
 * function of its arguments and the caller decides how to read the counters.
 */
export function computePartnerPerformance(
  partner: AffiliatePartner,
  payouts: AffiliatePayout[],
  clicks: number
): PartnerPerformance {
  const mine = payouts.filter((payout) => payout.partnerId === partner.id);

  let received = 0;
  let pending = 0;
  let grossSales = 0;
  let salesCount = 0;

  for (const payout of mine) {
    if (payout.paymentStatus === "received") received += payout.commissionAmount;
    else pending += payout.commissionAmount;
    // Sales happened whether or not the money has landed yet: the conversion
    // read is about the code working, not about the brand having settled.
    grossSales += payout.grossSales;
    salesCount += payout.salesCount;
  }

  return {
    partner,
    payouts: sortPayoutsByPeriod(mine),
    received,
    pending,
    grossSales,
    salesCount,
    clicks,
    conversionPercent: clicks > 0 ? (salesCount / clicks) * 100 : null,
    earningsPerClick: clicks > 0 ? received / clicks : null,
    commissionPerSale: salesCount > 0 ? (received + pending) / salesCount : null,
  };
}

/** Newest period first, matching how every other table in the app is ordered. */
export function sortPayoutsByPeriod(payouts: AffiliatePayout[]): AffiliatePayout[] {
  return [...payouts].sort((a, b) => {
    const left = parseSheetDate(b.periodEnd);
    const right = parseSheetDate(a.periodEnd);
    if (Number.isNaN(left)) return -1;
    if (Number.isNaN(right)) return 1;
    return left - right;
  });
}

export interface AffiliateTotals {
  received: number;
  pending: number;
  grossSales: number;
  salesCount: number;
  activePartners: number;
}

export function computeAffiliateTotals(
  partners: AffiliatePartner[],
  payouts: AffiliatePayout[]
): AffiliateTotals {
  let received = 0;
  let pending = 0;
  let grossSales = 0;
  let salesCount = 0;

  for (const payout of payouts) {
    if (payout.paymentStatus === "received") received += payout.commissionAmount;
    else pending += payout.commissionAmount;
    grossSales += payout.grossSales;
    salesCount += payout.salesCount;
  }

  return {
    received,
    pending,
    grossSales,
    salesCount,
    activePartners: partners.filter((partner) => partner.status === "active").length,
  };
}

// --- What the dashboard should chase ---------------------------------------

// A code with a handful of clicks that has never sold is ordinary; one with
// real traffic and nothing to show for it is usually a broken tracking link.
// The threshold keeps the dashboard quiet about the former.
const DEAD_CODE_MIN_CLICKS = 25;

/** How long a code may go without a recorded sale before it is worth asking why. */
const DEAD_CODE_DAYS = 30;

export type AffiliateAlertKind = "late-payout" | "no-sales";

export interface AffiliateAlert {
  kind: AffiliateAlertKind;
  partnerId: string;
  /** The payout at issue, for "late-payout"; null for a partner-level alert. */
  payoutId: string | null;
  partner: string;
  amount: number;
  label: string;
}

/**
 * Affiliate items the dashboard should raise, and deliberately only two.
 *
 * A pending commission on its own is not an open loop: nothing is owed to
 * anybody and there is no action to take, so it stays off the attention card
 * and lives on /affiliates as a figure. What does belong is a payout that has
 * passed the date its own schedule promised, and a code taking real traffic
 * with no sale recorded against it, which in practice means the tracking link
 * broke and every click since has been earning nothing.
 *
 * Ranked by money at stake, then by kind, so the largest late payout leads.
 */
export function selectAffiliateAlerts(
  partners: AffiliatePartner[],
  payouts: AffiliatePayout[],
  clicksByItem: Record<string, number>,
  now: Date = new Date()
): AffiliateAlert[] {
  const alerts: AffiliateAlert[] = [];

  for (const partner of partners) {
    if (partner.status === "ended") continue;

    for (const payout of payouts) {
      if (payout.partnerId !== partner.id) continue;
      const overdue = daysOverdue(partner, payout, now);
      if (overdue <= 0) continue;
      alerts.push({
        kind: "late-payout",
        partnerId: partner.id,
        payoutId: payout.id,
        partner: partner.name,
        amount: payout.commissionAmount,
        label: `Payout ${overdue} day${overdue === 1 ? "" : "s"} past due`,
      });
    }

    // Paused codes are meant to be quiet, so only a live one is chased.
    if (partner.status !== "active" || !partner.linkItemId) continue;

    const clicks = clicksByItem[partner.linkItemId] ?? 0;
    if (clicks < DEAD_CODE_MIN_CLICKS) continue;

    const mine = payouts.filter((payout) => payout.partnerId === partner.id);
    if (mine.length > 0) {
      // Judged against the newest period actually entered, never against the
      // calendar.
      //
      // Measuring staleness in days looks right and is not: a payout is
      // entered only once the brand reports it, so a healthy monthly program
      // sits six or seven weeks behind the calendar all the time, and a
      // day-based rule flags every one of them every month. What the creator
      // has actually recorded is the only honest evidence, so the question is
      // whether the most recent period they entered sold anything. A broken
      // tracking link shows up in the first period entered after it broke.
      const latest = sortPayoutsByPeriod(mine)[0];
      if (latest.salesCount > 0) continue;
      alerts.push({
        kind: "no-sales",
        partnerId: partner.id,
        payoutId: null,
        partner: partner.name,
        amount: 0,
        label: `${clicks} clicks, no sales in the latest period`,
      });
      continue;
    }

    // Never sold at all. Only worth raising once the code has had long enough
    // to: a program started last week has not failed yet.
    const started = parseSheetDate(partner.startDate);
    if (Number.isNaN(started)) continue;
    if (now.getTime() - started < DEAD_CODE_DAYS * 86_400_000) continue;
    alerts.push({
      kind: "no-sales",
      partnerId: partner.id,
      payoutId: null,
      partner: partner.name,
      amount: 0,
      label: `${clicks} clicks, never a recorded sale`,
    });
  }

  return alerts.sort((a, b) => b.amount - a.amount || a.kind.localeCompare(b.kind));
}
