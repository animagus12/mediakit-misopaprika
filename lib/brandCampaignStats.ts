import { isCampaignCalledOff } from "@/lib/campaigns";
import { computePaymentReliability, type PaymentReliability } from "@/lib/paymentReliability";
import type { BrandCampaignRecord } from "@/repositories/brandCampaigns";

// Client-safe aggregation over BrandCampaignRecord[]: kept out of
// repositories/brandCampaigns.ts (which is "server-only", since it fetches
// from Redis) so both the /brands list page and a brand's detail page can
// reuse this without pulling in the fetching code.

export function normalizeBrandName(name: string): string {
  return name.trim().toLowerCase();
}

// Matches by brandId when a record carries one: the correct, rename-proof
// link. Falls back to a case-insensitive name match only for older/unlinked
// records that predate Campaign.brandId (repositories/campaigns.ts).
export function recordsForBrand(
  brand: { id: string; name: string },
  records: BrandCampaignRecord[]
): BrandCampaignRecord[] {
  const key = normalizeBrandName(brand.name);
  return records.filter((record) =>
    record.brandId ? record.brandId === brand.id : normalizeBrandName(record.brand) === key
  );
}

// Sheet dates are DD/MM/YYYY; unparsable/blank dates sort as "never happened".
// Exported because BrandRow.lastCollabDate is one of these strings verbatim,
// so /brands has to order by the same rule the stats were built with.
export function parseSheetDate(date: string | null): number {
  const match = date?.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return Number.NEGATIVE_INFINITY;
  const [, day, month, year] = match;
  return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
}

export interface BrandStats {
  campaignCount: number; // excludes cancelled
  totalBilled: number; // sum of Total, excluding cancelled
  totalReceived: number; // sum of Total where Payment column says received
  pending: number; // sum of Total where Payment column says pending
  lastCollabDate: string | null; // DD/MM/YYYY, most recent non-cancelled record
  // Ad-usage renewal fees, broken out of the totals above rather than kept
  // outside them. They *are* money billed to this brand, so leaving them out
  // of totalBilled understated what the relationship is worth; what must not
  // absorb them is Campaign.total, the value a single deal was signed for.
  renewalReceived: number;
  renewalPending: number;
  renewalCount: number;
}

export const EMPTY_STATS: BrandStats = {
  campaignCount: 0,
  totalBilled: 0,
  totalReceived: 0,
  pending: 0,
  lastCollabDate: null,
  renewalReceived: 0,
  renewalPending: 0,
  renewalCount: 0,
};

// A called-off deal never happened commercially: excluded entirely, same as
// repositories/earnings.ts.
export function computeBrandStats(records: BrandCampaignRecord[]): BrandStats {
  const stats = { ...EMPTY_STATS };
  let lastCollabTime = Number.NEGATIVE_INFINITY;

  for (const record of records) {
    if (isCampaignCalledOff(record.status)) continue;

    stats.campaignCount += 1;
    stats.totalBilled += record.total;
    if (record.paymentStatus === "received") stats.totalReceived += record.total;
    if (record.paymentStatus === "pending") stats.pending += record.total;

    for (const renewal of record.usage.renewals) {
      stats.renewalCount += 1;
      stats.totalBilled += renewal.amount;
      if (renewal.paymentStatus === "received") {
        stats.renewalReceived += renewal.amount;
        stats.totalReceived += renewal.amount;
      } else if (renewal.paymentStatus === "pending") {
        stats.renewalPending += renewal.amount;
        stats.pending += renewal.amount;
      }
    }

    const uploadTime = parseSheetDate(record.uploadDate);
    const time = uploadTime !== Number.NEGATIVE_INFINITY ? uploadTime : parseSheetDate(record.date);
    if (time > lastCollabTime) {
      lastCollabTime = time;
      stats.lastCollabDate = record.uploadDate.trim() || record.date;
    }
  }

  return stats;
}

// Bulk variant for the /brands list page: one pass per brand rather than
// scanning the full record set redundantly for each row's stat cells. Keyed
// by name (not id) since that's what callers already look the result up by.
export function computeStatsByBrand(
  brands: { id: string; name: string }[],
  records: BrandCampaignRecord[]
): Map<string, BrandStats> {
  const map = new Map<string, BrandStats>();
  for (const brand of brands) {
    map.set(brand.name, computeBrandStats(recordsForBrand(brand, records)));
  }
  return map;
}

const DAY_MS = 86_400_000;

export interface DuePayment {
  record: BrandCampaignRecord;
  dueDate: string; // DD/MM/YYYY, as carried on the sheet row
  daysUntilDue: number; // whole days from today; negative once overdue, 0 = today
  overdue: boolean;
  label: string; // reverse-timer text: "Overdue by 2 days" / "Due today" / "Due in 5 days"
}

function dueLabel(days: number): string {
  if (days < 0) {
    const n = Math.abs(days);
    return `Overdue by ${n} day${n === 1 ? "" : "s"}`;
  }
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days} days`;
}

// The dashboard's payment-reminder feed: brand-campaign rows still marked
// pending on the Payment column that also carry a Payment Due date, as
// reverse timers, most-overdue first. Called-off deals and rows with no
// parseable due date are dropped. `now` is injectable so server render and
// tests aren't at the mercy of the wall clock.
//
// Deals only. A licence renewal is a separate debt against the same post and
// is chased in its own card (see selectOwedRenewals in lib/usageRights.ts):
// this row carries a deal's brand, campaign and total, which are the wrong
// numbers for a renewal.
export function selectDuePayments(records: BrandCampaignRecord[], now: Date = new Date()): DuePayment[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  return records
    .filter(
      (record) =>
        record.paymentStatus === "pending" && !isCampaignCalledOff(record.status)
    )
    .map((record) => ({ record, dueTime: parseSheetDate(record.paymentDue) }))
    .filter((entry) => Number.isFinite(entry.dueTime))
    .map(({ record, dueTime }) => {
      const daysUntilDue = Math.round((dueTime - today) / DAY_MS);
      return {
        record,
        dueDate: record.paymentDue,
        daysUntilDue,
        overdue: daysUntilDue < 0,
        label: dueLabel(daysUntilDue),
      };
    })
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue);
}

export interface DuePaymentsSummary {
  count: number;
  /** Sum of Total across the rows: what the deals are worth. */
  outstanding: number;
  overdueCount: number;
  /** Cash already past its due date. */
  overdueAmount: number;
  windowDays: number;
  /** Cash due inside the window, the overdue money included. */
  cashInWindow: number;
  windowCount: number;
}

/** A month, which is the horizon a freelance book is actually planned over. */
const CASH_IN_WINDOW_DAYS = 30;

/**
 * What the payments-due list comes to, rather than what each row of it says.
 *
 * The card had reverse timers on every row and no aggregate of any of them, so
 * the one question the list exists to answer, how much is landing and when,
 * had to be done in the reader's head.
 *
 * Two different bases here, deliberately. `outstanding` sums Total, because
 * that is what the rows below it print and a header that disagreed with its
 * own list would be worse than no header. `cashInWindow` sums the cash half,
 * because a pending barter parcel is value owed and is not money arriving in
 * an account: it cannot pay an editor, and this figure exists to be set
 * against what has to go out.
 *
 * Overdue money counts toward the window rather than being excluded from it.
 * It is owed now, so the soonest it can arrive is inside any window starting
 * today, and leaving it out would project a month that quietly assumes the
 * oldest debts are never collected.
 *
 * Taken over the rows given rather than recomputed from the records, so a
 * caller that has hidden a row (the card's optimistic "Mark received") gets a
 * total that agrees with what is on screen.
 */
export function summarizeDuePayments(
  due: DuePayment[],
  windowDays: number = CASH_IN_WINDOW_DAYS
): DuePaymentsSummary {
  const summary: DuePaymentsSummary = {
    count: due.length,
    outstanding: 0,
    overdueCount: 0,
    overdueAmount: 0,
    windowDays,
    cashInWindow: 0,
    windowCount: 0,
  };

  for (const entry of due) {
    summary.outstanding += entry.record.total;
    if (entry.overdue) {
      summary.overdueCount += 1;
      summary.overdueAmount += entry.record.amount;
    }
    if (entry.daysUntilDue <= windowDays && entry.record.amount > 0) {
      summary.cashInWindow += entry.record.amount;
      summary.windowCount += 1;
    }
  }

  return summary;
}

// --- Payment rows ----------------------------------------------------------

/**
 * One line in a brand's payment history: a deal, or a renewal bought against
 * one.
 *
 * Flattened here rather than in the tab, so a renewal and the deal it extends
 * are one list rather than two branches inside a table body. Both carry the
 * same invoiceRef/invoiceId pair the campaign record does, which is what lets
 * the tab resolve either kind through resolveCampaignInvoice: a renewal only
 * ever has the key, a deal that has not been reconciled only the reference.
 *
 * The shape satisfies PaymentTimingSource (lib/paymentReliability.ts), so the
 * same rows that are rendered are the ones the reliability read scores. A row
 * shown as "8 days late" that did not count toward the verdict above it would
 * be the table arguing with its own summary.
 */
export interface BrandPaymentRow {
  key: string;
  kind: "deal" | "renewal";
  label: string; // "IG Page", or "IG Page · usage renewal"
  status: string; // the deal's pipeline status; "" for a renewal
  /** What the Amount column shows: a deal's Total, a renewal's fee. */
  total: number;
  /**
   * The cash half, which is all a payment schedule can be kept or missed on,
   * and what PaymentTimingSource requires. Held apart from `total` because
   * this row used to carry the Total under this name, which quietly opted
   * every barter deal into a reliability score it was meant to be dropped
   * from, and counted barter value as money overdue.
   */
  amount: number;
  paymentStatus: BrandCampaignRecord["paymentStatus"];
  paymentDue: string;
  paidDate: string;
  paymentMethod: string;
  /** The free-text invoice reference to reconcile. "" on a renewal. */
  invoiceRef: string;
  /** The saved invoice's id, linkable directly. "" until one is linked. */
  invoiceId: string;
  /** Deal rows only, so the tab can compare the deal against its invoice. */
  record: BrandCampaignRecord | null;
}

/**
 * A brand's deals and their renewals as one list, each renewal directly under
 * the deal it extends.
 *
 * Grouped rather than sorted by date: a renewal only means anything next to
 * the post it licenses, and a chronological list would scatter the two halves
 * of the same arrangement across the table.
 */
export function selectBrandPaymentRows(records: BrandCampaignRecord[]): BrandPaymentRow[] {
  const rows: BrandPaymentRow[] = [];

  for (const record of records) {
    const name = record.campaign.trim();
    rows.push({
      key: record.campaignId || `${record.campaign}-${record.date}`,
      kind: "deal",
      label: name || "-",
      status: record.status,
      total: record.total,
      amount: record.amount,
      paymentStatus: record.paymentStatus,
      paymentDue: record.paymentDue,
      paidDate: record.paidDate,
      paymentMethod: record.paymentMethod,
      invoiceRef: record.invoiceRef,
      invoiceId: record.invoiceId ?? "",
      record,
    });

    for (const renewal of record.usage.renewals) {
      rows.push({
        key: `${record.campaignId}:${renewal.id}`,
        kind: "renewal",
        label: name ? `${name} · usage renewal` : "Ad usage renewal",
        // No pipeline status of its own: a renewal is agreed or it is not.
        status: "",
        // Always cash: a licence extension is never bartered for, so the two
        // are the same figure.
        total: renewal.amount,
        amount: renewal.amount,
        paymentStatus: renewal.paymentStatus,
        paymentDue: renewal.paymentDue,
        paidDate: renewal.paidDate,
        paymentMethod: renewal.paymentMethod,
        invoiceRef: "",
        invoiceId: renewal.invoiceId,
        record: null,
      });
    }
  }

  return rows;
}

// --- Portfolio reliability -------------------------------------------------

export interface BrandReliability {
  brand: string;
  /** null on a record never linked to a CRM brand, so callers know not to link. */
  brandId: string | null;
  reliability: PaymentReliability;
}

export interface PortfolioReliability {
  /** Every payment across every brand, scored as one record. */
  overall: PaymentReliability;
  /** One entry per brand with enough history to rate, worst score first. */
  ranked: BrandReliability[];
}

/**
 * The reliability read a brand's Payments tab does, run across the whole book.
 *
 * The per-brand verdict answers "should I take this deal"; nobody was asking
 * the portfolio the question it can answer, which is "who do I stop taking
 * deals from". Both go through computePaymentReliability on the rows
 * selectBrandPaymentRows produces, so the dashboard and a brand's own tab
 * cannot come to different conclusions about the same payments.
 *
 * Grouped by brandId where a record carries one and by name otherwise, the
 * same rename-proof fallback recordsForBrand makes. Brands the score refuses
 * to rate are left out of `ranked` rather than sorted to one end: below
 * MIN_RELIABILITY_SAMPLE there is no verdict to rank on, and putting a brand
 * with one late payment at the top of a "slowest payers" list would be
 * inventing the evidence the module is careful not to invent.
 */
export function selectPortfolioReliability(
  records: BrandCampaignRecord[],
  now: Date = new Date()
): PortfolioReliability {
  const overall = computePaymentReliability(selectBrandPaymentRows(records), now);

  const byBrand = new Map<string, BrandCampaignRecord[]>();
  for (const record of records) {
    const key = record.brandId ?? normalizeBrandName(record.brand);
    const group = byBrand.get(key);
    if (group) group.push(record);
    else byBrand.set(key, [record]);
  }

  const ranked: BrandReliability[] = [];
  for (const group of byBrand.values()) {
    const reliability = computePaymentReliability(selectBrandPaymentRows(group), now);
    if (reliability.score === null) continue;
    ranked.push({
      brand: group[0].brand,
      brandId: group[0].brandId,
      reliability,
    });
  }

  // Worst first. Money still overdue breaks a tie ahead of sample size,
  // because an open debt is the part of a tied score that is still running.
  ranked.sort(
    (a, b) =>
      (a.reliability.score ?? 0) - (b.reliability.score ?? 0) ||
      b.reliability.overdueAmount - a.reliability.overdueAmount ||
      b.reliability.sample - a.reliability.sample
  );

  return { overall, ranked };
}
