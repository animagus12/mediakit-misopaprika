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
