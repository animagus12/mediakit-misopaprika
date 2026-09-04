import "server-only";
import { getCampaigns } from "./campaigns.writer.server";

export interface MonthlyDeal {
  brand: string;
  amount: number; // the deal's Total (Amount + Barter Value)
  deliverables: string; // e.g. "1 Reel, 1 Story"
}

export interface MonthlyEarnings {
  month: string; // "YYYY-MM"
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
  monthly: MonthlyEarnings[]; // descending by month — most recent first
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

// A cancelled deal never happened commercially — excluded from every stat
// (received, pending, monthly), not just netted out of "pending".
function isCancelled(status: string): boolean {
  return status.trim().toLowerCase() === "cancelled";
}

class CampaignsEarningsRepository implements IEarningsRepository {
  async getSummary(): Promise<EarningsSummary> {
    const campaigns = await getCampaigns();

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

    for (const campaign of campaigns) {
      if (isCancelled(campaign.status)) continue;

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
}

export const earningsRepository: IEarningsRepository = new CampaignsEarningsRepository();
