import "server-only";
import { isCampaignCalledOff } from "@/lib/campaigns";
import { getCampaigns } from "./campaigns.writer.server";
import { getAffiliatePartners } from "./affiliatePartners.writer.server";
import { getAffiliatePayouts } from "./affiliatePayouts.writer.server";
import type { Campaign } from "./campaigns";
import type { AffiliatePayout } from "./affiliatePayouts";

/**
 * A commission payout, with the name of the program that paid it.
 *
 * summarizeEarnings takes this rather than a bare AffiliatePayout so it can
 * stay a pure function of two arrays while the monthly ledger still gets a
 * name to show: a payout on its own carries only a partnerId, which would
 * render as a UUID. The join happens once, in the repository below.
 */
export interface EarningsPayout
  extends Pick<
    AffiliatePayout,
    "commissionAmount" | "paidDate" | "periodEnd" | "paymentStatus"
  > {
  partner: string;
}

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
  /**
   * Affiliate commission received this month. Counted into `total` alongside
   * cash and barter, and kept as its own figure because it is the one income
   * source that recurs without another deal being signed.
   */
  commission: number;
  pending: number;
  deals: MonthlyDeal[];
}

export interface EarningsSummary {
  total: number;
  paid: number;
  barter: number;
  commission: number;
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
export function summarizeEarnings(
  campaigns: Campaign[],
  payouts: EarningsPayout[] = []
): EarningsSummary {
  const monthlyMap = new Map<string, MonthlyEarnings>();
  const getBucket = (key: string) => {
    let bucket = monthlyMap.get(key);
    if (!bucket) {
      bucket = { month: key, total: 0, paid: 0, barter: 0, commission: 0, pending: 0, deals: [] };
      monthlyMap.set(key, bucket);
    }
    return bucket;
  };

  let total = 0;
  let paid = 0;
  let barter = 0;
  let commission = 0;
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

  // Affiliate commission, the third income source, counted by the same rules
  // as everything above: credited to the month it was actually paid in,
  // falling back to the month the period closed, which is the rule renewals
  // already use for the same reason (a payout with no paid date yet still
  // belongs to a month).
  //
  // Commission is spendable money, never product, so it never touches
  // `barter`. It is deliberately kept *out* of `paid` rather than folded into
  // it: the four figures are disjoint and sum to `total`, which is what lets
  // the earnings chart stack them without double counting and what keeps each
  // one answerable on its own ("how much came from deals" stays a question
  // `paid` can answer). Consumers that want every rupee that can pay an
  // editor add `paid` and `commission`, as computeMarginSeries does.
  for (const payout of payouts) {
    if (payout.commissionAmount <= 0) continue; // a period that sold nothing is not earnings

    const key = monthKey(payout.paidDate) ?? monthKey(payout.periodEnd);
    const deal: MonthlyDeal = {
      brand: payout.partner,
      amount: payout.commissionAmount,
      deliverables: "Affiliate commission",
    };

    if (payout.paymentStatus === "pending") {
      pending += payout.commissionAmount;
      if (key) {
        const bucket = getBucket(key);
        bucket.pending += payout.commissionAmount;
        bucket.deals.push(deal);
      }
      continue;
    }

    total += payout.commissionAmount;
    commission += payout.commissionAmount;
    if (key) {
      const bucket = getBucket(key);
      bucket.total += payout.commissionAmount;
      bucket.commission += payout.commissionAmount;
      bucket.deals.push(deal);
    }
  }

  const monthly = [...monthlyMap.values()].sort((a, b) => b.month.localeCompare(a.month));
  return { total, paid, barter, commission, pending, monthly };
}

class CampaignsEarningsRepository implements IEarningsRepository {
  async getSummary(): Promise<EarningsSummary> {
    // Affiliate income is additive to the deal book, so a failure to read
    // either affiliate store costs the commission line and not the whole
    // earnings summary, which every page above depends on.
    const [campaigns, partners, payouts] = await Promise.all([
      getCampaigns(),
      getAffiliatePartners().catch(() => []),
      getAffiliatePayouts().catch(() => []),
    ]);

    const partnerName = new Map(partners.map((partner) => [partner.id, partner.name]));
    const income: EarningsPayout[] = payouts.map((payout) => ({
      commissionAmount: payout.commissionAmount,
      paidDate: payout.paidDate,
      periodEnd: payout.periodEnd,
      paymentStatus: payout.paymentStatus,
      // A payout whose partner was somehow lost still counts as income; it
      // just has nothing better than a generic label to show for itself.
      partner: partnerName.get(payout.partnerId) ?? "Affiliate",
    }));

    return summarizeEarnings(campaigns, income);
  }
}

export const earningsRepository: IEarningsRepository = new CampaignsEarningsRepository();
