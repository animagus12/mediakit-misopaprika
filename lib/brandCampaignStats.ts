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
function parseSheetDate(date: string): number {
  const match = date.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
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

// A cancelled deal never happened commercially: excluded entirely, same as
// repositories/earnings.ts's isCancelled skip.
export function computeBrandStats(records: BrandCampaignRecord[]): BrandStats {
  const stats = { ...EMPTY_STATS };
  let lastCollabTime = Number.NEGATIVE_INFINITY;

  for (const record of records) {
    if (record.status.trim().toLowerCase() === "cancelled") continue;

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
// reverse timers, most-overdue first. Cancelled deals and rows with no
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
        record.paymentStatus === "pending" && record.status.trim().toLowerCase() !== "cancelled"
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

// --- Payment rows ----------------------------------------------------------

/**
 * One line in a brand's payment history: a deal, or a renewal bought against
 * one.
 *
 * Flattened here rather than in the tab, because the two carry different
 * links to an invoice and would otherwise be two branches inside a table body.
 * A deal points at one by the free-text reference typed on the campaign form,
 * which has to be matched back by number; a renewal was written by the app
 * alongside the invoice that bills for it and carries its real id.
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
  amount: number;
  paymentStatus: BrandCampaignRecord["paymentStatus"];
  paymentDue: string;
  paidDate: string;
  paymentMethod: string;
  /** Deal rows: the free-text invoice reference to reconcile. "" on a renewal. */
  invoiceRef: string;
  /** Renewal rows: the saved invoice's id, linkable directly. "" on a deal. */
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
      amount: record.total,
      paymentStatus: record.paymentStatus,
      paymentDue: record.paymentDue,
      paidDate: record.paidDate,
      paymentMethod: record.paymentMethod,
      invoiceRef: record.invoiceId,
      invoiceId: "",
      record,
    });

    for (const renewal of record.usage.renewals) {
      rows.push({
        key: `${record.campaignId}:${renewal.id}`,
        kind: "renewal",
        label: name ? `${name} · usage renewal` : "Ad usage renewal",
        // No pipeline status of its own: a renewal is agreed or it is not.
        status: "",
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
