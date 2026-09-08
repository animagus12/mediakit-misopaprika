import "server-only";
import { isCampaignCalledOff } from "@/lib/campaigns";
import { getCampaigns } from "./campaigns.writer.server";
import type { Campaign } from "./campaigns";

export interface MonthlyDeal {
  brand: string;
  amount: number; // the deal's Total (Amount + Barter Value), or a renewal's fee
  deliverables: string; // e.g. "1 Reel, 1 Story", or "Usage renewal"
}

export interface MonthlyEarnings {
  month: string; // "YYYY-MM"
  /**
   * Money actually received this month: paid + barter, and never `pending`,
   * which is tracked separately below.
   *
   * The name undersells that, so it is worth saying: a deal still awaiting
   * payment contributes to `pending` and to nothing else here. The dashboard
   * renders this column as "Received" for the same reason.
   */
  total: number;
  paid: number;
  barter: number;
  pending: number;
  deals: MonthlyDeal[];
}

export interface EarningsSummary {
  total: number;
  paid: number;
  barter: number;
  pending: number;
  monthly: MonthlyEarnings[]; // descending by month, most recent first
}

export interface IEarningsRepository {
  getSummary(): Promise<EarningsSummary>;
}

// Campaign dates are DD/MM/YYYY. Returns a "YYYY-MM" bucket key, or null when
// blank/unparsable. Callers fall back from uploadDate to date when blank.
function monthKey(raw: string | undefined): string | null {
  const match = raw?.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, , month, year] = match;
  return `${year}-${month.padStart(2, "0")}`;
}

/**
 * The whole of the earnings projection, as a pure function of the deals.
 *
 * Split out of the repository below so that what counts as income can be
 * exercised directly, against deals chosen to test it, rather than only
 * against whatever the store happens to hold. The repository keeps the
 * fetching; this keeps the rules.
 */
export function summarizeEarnings(campaigns: Campaign[]): EarningsSummary {
  const monthlyMap = new Map<string, MonthlyEarnings>();
  const getBucket = (key: string) => {
    let bucket = monthlyMap.get(key);
    if (!bucket) {
      bucket = { month: key, total: 0, paid: 0, barter: 0, pending: 0, deals: [] };
      monthlyMap.set(key, bucket);
    }
    return bucket;
  };

  let total = 0;
  let paid = 0;
  let barter = 0;
  let pending = 0;

  // A licence renewal is money against the same brand for the same post,
  // and it lands in a month of its own: the fee is credited to the month it
  // was actually paid in, falling back to the month the extended term
  // started. It is deliberately not folded into Campaign.total, which is the
  // deal's own headline value and would silently drift upward every time a
  // brand bought another three months.
  const countRenewals = (campaign: (typeof campaigns)[number]) => {
    for (const renewal of campaign.usage.renewals) {
      if (renewal.amount <= 0) continue; // an extension granted for free is not earnings

      const key = monthKey(renewal.paidDate) ?? monthKey(renewal.startDate);
      const deal: MonthlyDeal = {
        brand: campaign.brand,
        amount: renewal.amount,
        deliverables: "Usage renewal",
      };

      if (renewal.paymentStatus === "pending") {
        pending += renewal.amount;
        if (key) {
          const bucket = getBucket(key);
          bucket.pending += renewal.amount;
          bucket.deals.push(deal);
        }
        continue;
      }
      if (renewal.paymentStatus !== "received") continue;

      // Always cash: a licence extension is never bartered for.
      total += renewal.amount;
      paid += renewal.amount;
      if (key) {
        const bucket = getBucket(key);
        bucket.total += renewal.amount;
        bucket.paid += renewal.amount;
        bucket.deals.push(deal);
      }
    }
  };

  for (const campaign of campaigns) {
    // Excluded from every stat (received, pending, monthly), not just
    // netted out of "pending", and before countRenewals: a licence sold on a
    // deal that was called off is not income either.
    if (isCampaignCalledOff(campaign.status)) continue;

    countRenewals(campaign);

    const key = monthKey(campaign.uploadDate) ?? monthKey(campaign.date);
    const deal: MonthlyDeal = {
      brand: campaign.brand,
      amount: campaign.total,
      deliverables: [campaign.reels, campaign.story].filter(Boolean).join(", "),
    };

    if (campaign.paymentStatus === "pending") {
      pending += campaign.total;
      if (key) {
        const bucket = getBucket(key);
        bucket.pending += campaign.total;
        bucket.deals.push(deal);
      }
      continue;
    }
    if (campaign.paymentStatus !== "received") continue;

    total += campaign.total;
    paid += campaign.amount;
    barter += campaign.barterValue;

    if (key) {
      const bucket = getBucket(key);
      bucket.total += campaign.total;
      bucket.paid += campaign.amount;
      bucket.barter += campaign.barterValue;
      bucket.deals.push(deal);
    }
  }

  const monthly = [...monthlyMap.values()].sort((a, b) => b.month.localeCompare(a.month));
  return { total, paid, barter, pending, monthly };
}

class CampaignsEarningsRepository implements IEarningsRepository {
  async getSummary(): Promise<EarningsSummary> {
    return summarizeEarnings(await getCampaigns());
  }
}

export const earningsRepository: IEarningsRepository = new CampaignsEarningsRepository();
