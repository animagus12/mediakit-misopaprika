import type { BrandCampaignRecord } from "@/repositories/brandCampaigns";

// Client-safe aggregation over BrandCampaignRecord[] — kept out of
// repositories/brandCampaigns.ts (which is "server-only", since it fetches
// the sheet directly) so both the /brands list page and a brand's detail
// page can reuse this without pulling in the sheet-fetching code.

export function normalizeBrandName(name: string): string {
  return name.trim().toLowerCase();
}

export function recordsForBrand(brandName: string, records: BrandCampaignRecord[]): BrandCampaignRecord[] {
  const key = normalizeBrandName(brandName);
  return records.filter((record) => normalizeBrandName(record.brand) === key);
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
}

export const EMPTY_STATS: BrandStats = { campaignCount: 0, totalBilled: 0, totalReceived: 0, pending: 0, lastCollabDate: null };

// A cancelled deal never happened commercially — excluded entirely, same as
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

    const uploadTime = parseSheetDate(record.uploadDate);
    const time = uploadTime !== Number.NEGATIVE_INFINITY ? uploadTime : parseSheetDate(record.date);
    if (time > lastCollabTime) {
      lastCollabTime = time;
      stats.lastCollabDate = record.uploadDate.trim() || record.date;
    }
  }

  return stats;
}

// Bulk variant for the /brands list page — one pass per brand rather than
// scanning the full record set redundantly for each row's stat cells.
export function computeStatsByBrand(brandNames: string[], records: BrandCampaignRecord[]): Map<string, BrandStats> {
  const map = new Map<string, BrandStats>();
  for (const name of brandNames) {
    map.set(name, computeBrandStats(recordsForBrand(name, records)));
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
