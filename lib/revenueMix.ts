import { isCampaignCalledOff } from "@/lib/campaigns";
import { normalizeBrandName } from "@/lib/brandCampaignStats";
import { monthsAgoKey } from "@/lib/earnings";
import type { Campaign } from "@/repositories/campaigns";
import type { EarningsSummary } from "@/repositories/earnings";

// Where the income comes from, as opposed to how much of it there is.
//
// The dashboard could say what was earned and never what kind of income it
// was: how much of it rests on one brand, how much is a parcel rather than
// money, how much is a licence rather than a post. Each is a fact about the
// business rather than about a deal, and each is a division of two figures
// that were both already stored.

// --- Concentration ---------------------------------------------------------

export interface BrandShare {
  brand: string;
  /** null on a record never linked to a CRM brand, so callers know not to link. */
  brandId: string | null;
  value: number;
  deals: number;
  percent: number;
}

export interface RevenueConcentration {
  /** Everything booked: the denominator every percentage here is a share of. */
  total: number;
  brands: number;
  deals: number;
  /** The single largest brand, or null on an empty book. */
  top: BrandShare | null;
  /** Combined share of the three largest, which is the read that finds a cluster. */
  topThreePercent: number;
  /** Brands that came back for a second deal. */
  repeatBrands: number;
  /** repeatBrands as a share of every brand: how often a first deal leads to a second. */
  repeatPercent: number;
  /** Share of income coming from brands that came back. */
  repeatRevenuePercent: number;
}

const EMPTY_CONCENTRATION: RevenueConcentration = {
  total: 0,
  brands: 0,
  deals: 0,
  top: null,
  topThreePercent: 0,
  repeatBrands: 0,
  repeatPercent: 0,
  repeatRevenuePercent: 0,
};

const TOP_CLUSTER = 3;

/**
 * The share above which one brand is worth flagging rather than just
 * reporting.
 *
 * A quarter of income from a single name is the common rule of thumb for
 * where a client relationship stops being a good one and starts being a
 * dependency: losing it costs a quarter of the book at a month's notice. It
 * lives here rather than in the card that colours the tile, so the threshold
 * is a stated business rule and not a number chosen inside some markup.
 */
export const CONCENTRATION_WARNING_PERCENT = 25;

/**
 * How much of the book rests on how few names.
 *
 * Measured on everything booked, received and pending together, rather than on
 * money that has actually landed. Concentration is a fact about where deals
 * come from, and a brand's largest deal sitting unpaid for a fortnight does not
 * make the creator less dependent on it: on the current book, scoring received
 * money only would hide the largest brand entirely, which is exactly backwards
 * for a risk read. Called-off deals are excluded, as everywhere else.
 *
 * Renewal fees count toward the brand that bought them, for the same reason
 * computeBrandStats folds them into totalBilled: they are money against that
 * relationship, and leaving them out understates what it is worth.
 *
 * Grouped by brandId where a record carries one and by normalized name
 * otherwise, the rename-proof fallback recordsForBrand already makes.
 */
export function computeConcentration(campaigns: Campaign[]): RevenueConcentration {
  const byBrand = new Map<string, BrandShare>();
  let total = 0;
  let deals = 0;

  for (const campaign of campaigns) {
    if (isCampaignCalledOff(campaign.status)) continue;

    let value = campaign.total;
    for (const renewal of campaign.usage.renewals) {
      if (renewal.paymentStatus === "received" || renewal.paymentStatus === "pending") {
        value += renewal.amount;
      }
    }

    total += value;
    deals += 1;

    const key = campaign.brandId ?? normalizeBrandName(campaign.brand);
    const share = byBrand.get(key);
    if (share) {
      share.value += value;
      share.deals += 1;
    } else {
      byBrand.set(key, {
        brand: campaign.brand,
        brandId: campaign.brandId,
        value,
        deals: 1,
        percent: 0,
      });
    }
  }

  if (byBrand.size === 0) return EMPTY_CONCENTRATION;

  const shares = [...byBrand.values()].sort((a, b) => b.value - a.value);
  const share = (value: number) => (total > 0 ? (value / total) * 100 : 0);
  for (const entry of shares) entry.percent = share(entry.value);

  const repeat = shares.filter((entry) => entry.deals > 1);
  const sum = (entries: BrandShare[]) => entries.reduce((acc, entry) => acc + entry.value, 0);

  return {
    total,
    brands: shares.length,
    deals,
    top: shares[0],
    topThreePercent: share(sum(shares.slice(0, TOP_CLUSTER))),
    repeatBrands: repeat.length,
    repeatPercent: (repeat.length / shares.length) * 100,
    repeatRevenuePercent: share(sum(repeat)),
  };
}

// --- Barter share ----------------------------------------------------------

/** Months per comparison window: a quarter, which is short enough to move. */
const TREND_MONTHS = 3;

export interface BarterShare {
  barter: number;
  cash: number;
  total: number;
  /** Barter as a percentage of everything received, lifetime. */
  percent: number;
  /** The same read over the last three complete months, or null with no income there. */
  recentPercent: number | null;
  /** And over the three before those. */
  priorPercent: number | null;
  /** recentPercent minus priorPercent, in percentage points; null without both. */
  deltaPoints: number | null;
}

/**
 * How much of what came in was a parcel rather than money.
 *
 * The dashboard reports barter as a rupee figure beside cash, which is true
 * and hides the thing worth knowing: barter is unbankable, it cannot pay an
 * editor, and a book drifting toward it gets busier without getting richer.
 * A percentage says that; two figures side by side do not.
 *
 * The direction compares the last three complete months against the three
 * before them. Complete months only, and for the reason computeMonthTrend
 * gives at length: income here is counted when it is received, so the month in
 * progress is near-empty by construction and comparing part of a month against
 * whole ones is not a comparison. Three months rather than one, because a
 * single barter deal can swing one month's mix by forty points.
 *
 * Percentage points, never a percentage change: barter going from 10% to 20%
 * of income is a ten point move, and calling it "100% up" describes the same
 * fact in a way nobody can act on.
 */
export function computeBarterShare(
  summary: EarningsSummary,
  now: Date = new Date()
): BarterShare {
  const windowShare = (from: number): number | null => {
    const oldest = monthsAgoKey(from + TREND_MONTHS - 1, now);
    const newest = monthsAgoKey(from, now);
    let barter = 0;
    let total = 0;
    for (const month of summary.monthly) {
      if (month.month < oldest || month.month > newest) continue;
      barter += month.barter;
      total += month.total;
    }
    return total > 0 ? (barter / total) * 100 : null;
  };

  const recentPercent = windowShare(1);
  const priorPercent = windowShare(1 + TREND_MONTHS);

  return {
    barter: summary.barter,
    cash: summary.paid,
    total: summary.total,
    percent: summary.total > 0 ? (summary.barter / summary.total) * 100 : 0,
    recentPercent,
    priorPercent,
    deltaPoints:
      recentPercent !== null && priorPercent !== null ? recentPercent - priorPercent : null,
  };
}

// --- Licensing -------------------------------------------------------------

export interface RenewalShare {
  received: number;
  pending: number;
  count: number;
  /** Brands that have bought an extension: whether this is one client or a habit. */
  brands: number;
  /** Renewal fees as a percentage of everything booked. */
  percent: number;
}

/**
 * What share of the book is licensing rather than posting.
 *
 * repositories/earnings.ts has counted renewal fees into income since the
 * licence was modelled, but only ever as part of a total, so a business
 * quietly turning into a licensing business would show up as a slightly better
 * month. Expressed against the same booked total computeConcentration uses, so
 * the two shares on the same row are shares of the same number.
 *
 * Free extensions are excluded, as they are from earnings: a term granted at
 * no charge is a favour, not revenue.
 */
export function computeRenewalShare(campaigns: Campaign[], bookedTotal: number): RenewalShare {
  const brands = new Set<string>();
  let received = 0;
  let pending = 0;
  let count = 0;

  for (const campaign of campaigns) {
    if (isCampaignCalledOff(campaign.status)) continue;

    for (const renewal of campaign.usage.renewals) {
      if (renewal.amount <= 0) continue;
      if (renewal.paymentStatus === "received") received += renewal.amount;
      else if (renewal.paymentStatus === "pending") pending += renewal.amount;
      else continue;

      count += 1;
      brands.add(campaign.brandId ?? normalizeBrandName(campaign.brand));
    }
  }

  const total = received + pending;
  return {
    received,
    pending,
    count,
    brands: brands.size,
    percent: bookedTotal > 0 ? (total / bookedTotal) * 100 : 0,
  };
}

// --- The whole mix ---------------------------------------------------------

export interface RevenueMix {
  concentration: RevenueConcentration;
  barter: BarterShare;
  renewals: RenewalShare;
}

/**
 * One pass for the three shares, so a caller reads the mix rather than
 * assembling it and so the renewal share is always taken against the booked
 * total the concentration read produced.
 */
export function computeRevenueMix(
  campaigns: Campaign[],
  summary: EarningsSummary,
  now: Date = new Date()
): RevenueMix {
  const concentration = computeConcentration(campaigns);
  return {
    concentration,
    barter: computeBarterShare(summary, now),
    renewals: computeRenewalShare(campaigns, concentration.total),
  };
}
