import "server-only";
import { campaignDeliverables, isCampaignCalledOff } from "@/lib/campaigns";
import { buildInvoiceNumber } from "@/lib/invoice";
import { roundMoney } from "@/lib/money";
import { getAffiliatePartners } from "./affiliatePartners.writer.server";
import { getAffiliatePayouts } from "./affiliatePayouts.writer.server";
import { readSettledLedger } from "./invoices.writer.server";
import type { Campaign } from "./campaigns";
import type { Invoice } from "./invoices";
import type { Settlement } from "./payments";
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
  /**
   * What this deal (or renewal) put into this month: the cash that arrived,
   * the barter delivered and whatever is still owed, filed here. A deal paid
   * in instalments shows once in each month money arrived.
   */
  amount: number;
  deliverables: string; // e.g. "1 Reel, 1 Story", or "Usage renewal"
}

export interface MonthlyEarnings {
  month: string; // "YYYY-MM"
  /**
   * Money actually received this month: paid + barter + commission, and
   * never `pending`, which is tracked separately below.
   *
   * Not what a "Received" label shows: this counts barter, which is product
   * rather than money. Those surfaces read cashReceived (lib/earnings.ts),
   * which is `paid` plus `commission`.
   */
  total: number;
  /**
   * Brand cash settled this month, by the date each payment arrived: the
   * gross amount, TDS included. `net` + `tds` + `fees` always equals it.
   */
  paid: number;
  /** TDS the brands withheld from this month's payments. */
  tds: number;
  /** Bank or gateway charges taken from this month's payments. */
  fees: number;
  /** What actually landed in an account this month: `paid` less TDS and charges. */
  net: number;
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
  tds: number;
  fees: number;
  net: number;
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

// A ledger entry's bucketDate is a yyyy-mm-dd day key, or "" when neither the
// payment nor its target carries a usable date.
function entryMonth(bucketDate: string): string | null {
  return bucketDate ? bucketDate.slice(0, 7) : null;
}

/**
 * The whole of the earnings projection, as a pure function of the deals.
 *
 * Split out of the repository below so that what counts as income can be
 * exercised directly, against deals chosen to test it, rather than only
 * against whatever the store happens to hold. The repository keeps the
 * fetching; this keeps the rules.
 *
 * Cash comes from each deal's and renewal's settlement (lib/payments.ts): every
 * payment entry is filed in the month it arrived, so a deal paid in two
 * instalments lands in two months, and only what is still owed counts as
 * pending. A deal or renewal with no recorded payment reads its legacy fields
 * as one virtual entry, which keeps a book written before the ledger reading
 * as it did. Barter is never cash: it is filed in the posting month once
 * delivered, and is pending until then.
 *
 * `invoices` adds the payments recorded on invoices that bill no deal. Only
 * recorded ones: an old standalone invoice marked paid by hand never counted,
 * since nothing said whether a deal already counted the same money, and it
 * still doesn't. A linked invoice's money is its deal's, counted above.
 */
export function summarizeEarnings(
  campaigns: Campaign[],
  payouts: EarningsPayout[] = [],
  invoices: Invoice[] = []
): EarningsSummary {
  const monthlyMap = new Map<string, MonthlyEarnings>();
  // One MonthlyDeal per deal (or renewal) per month, so instalments add up
  // on a single row rather than repeating the deal.
  const dealRows = new Map<string, MonthlyDeal>();
  const getBucket = (key: string) => {
    let bucket = monthlyMap.get(key);
    if (!bucket) {
      bucket = {
        month: key,
        total: 0,
        paid: 0,
        tds: 0,
        fees: 0,
        net: 0,
        barter: 0,
        commission: 0,
        pending: 0,
        deals: [],
      };
      monthlyMap.set(key, bucket);
    }
    return bucket;
  };
  const fileDeal = (key: string, rowId: string, brand: string, deliverables: string, amount: number) => {
    if (amount <= 0) return;
    const id = `${key}|${rowId}`;
    const row = dealRows.get(id);
    if (row) {
      row.amount += amount;
      return;
    }
    const created: MonthlyDeal = { brand, amount, deliverables };
    dealRows.set(id, created);
    getBucket(key).deals.push(created);
  };

  const totals = { total: 0, paid: 0, tds: 0, fees: 0, net: 0, barter: 0, commission: 0, pending: 0 };

  // Each settled payment, filed by the day it arrived. Called-off deals count
  // only payments actually recorded against them (a kill fee is real money);
  // their legacy fields, like everything else on a called-off deal, stay out.
  const countEntries = (
    settlement: Settlement,
    storedOnly: boolean,
    rowId: string,
    brand: string,
    deliverables: string
  ) => {
    for (const entry of settlement.entries) {
      if (storedOnly && entry.source !== "stored") continue;
      totals.total += entry.gross;
      totals.paid += entry.gross;
      totals.tds += entry.tds;
      totals.fees += entry.bankFee;
      totals.net += entry.net;
      const key = entryMonth(entry.bucketDate);
      if (!key) continue;
      const bucket = getBucket(key);
      bucket.total += entry.gross;
      bucket.paid += entry.gross;
      bucket.tds += entry.tds;
      bucket.fees += entry.bankFee;
      bucket.net += entry.net;
      fileDeal(key, rowId, brand, deliverables, entry.gross);
    }
  };

  const countPending = (amount: number, key: string | null, rowId: string, brand: string, deliverables: string) => {
    if (amount <= 0) return;
    totals.pending += amount;
    if (!key) return;
    getBucket(key).pending += amount;
    fileDeal(key, rowId, brand, deliverables, amount);
  };

  // A licence renewal is money against the same brand for the same post,
  // and it lands in a month of its own: each payment is credited to the month
  // it arrived in, and what is still owed to the month the extended term
  // started. It is deliberately not folded into Campaign.total, which is the
  // deal's own headline value and would silently drift upward every time a
  // brand bought another three months.
  const countRenewals = (campaign: Campaign, calledOff: boolean) => {
    for (const renewal of campaign.usage.renewals) {
      if (renewal.amount <= 0) continue; // an extension granted for free is not earnings
      const rowId = `renewal:${campaign.id}:${renewal.id}`;
      // Always cash: a licence extension is never bartered for.
      countEntries(renewal.settlement, calledOff, rowId, campaign.brand, "Usage renewal");
      if (calledOff || renewal.paymentStatus !== "pending") continue;
      countPending(renewal.settlement.remaining, monthKey(renewal.startDate), rowId, campaign.brand, "Usage renewal");
    }
  };

  for (const campaign of campaigns) {
    // A called-off deal is excluded from every stat (received, pending,
    // monthly) except money actually recorded as paid against it, and so is a
    // licence sold on it.
    const calledOff = isCampaignCalledOff(campaign.status);
    countRenewals(campaign, calledOff);

    const key = monthKey(campaign.uploadDate) ?? monthKey(campaign.date);
    const rowId = `deal:${campaign.id}`;
    const deliverables = campaignDeliverables(campaign).join(", ");

    if (campaign.settlement) {
      countEntries(campaign.settlement, calledOff, rowId, campaign.brand, deliverables);
      if (!calledOff && campaign.paymentStatus === "pending") {
        countPending(campaign.settlement.remaining, key, rowId, campaign.brand, deliverables);
      }
    }
    if (calledOff || campaign.barterValue <= 0) continue;

    if (campaign.barterState === "received") {
      totals.total += campaign.barterValue;
      totals.barter += campaign.barterValue;
      if (key) {
        const bucket = getBucket(key);
        bucket.total += campaign.barterValue;
        bucket.barter += campaign.barterValue;
        fileDeal(key, rowId, campaign.brand, deliverables, campaign.barterValue);
      }
    } else if (campaign.barterState === "pending") {
      countPending(campaign.barterValue, key, rowId, campaign.brand, deliverables);
    }
  }

  for (const invoice of invoices) {
    if (invoice.owner) continue;
    const label = `Invoice ${buildInvoiceNumber(invoice.invoiceNo)}`;
    countEntries(invoice.settlement, true, `invoice:${invoice.id}`, invoice.client.name.trim() || label, label);
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
      totals.pending += payout.commissionAmount;
      if (key) {
        const bucket = getBucket(key);
        bucket.pending += payout.commissionAmount;
        bucket.deals.push(deal);
      }
      continue;
    }

    totals.total += payout.commissionAmount;
    totals.commission += payout.commissionAmount;
    if (key) {
      const bucket = getBucket(key);
      bucket.total += payout.commissionAmount;
      bucket.commission += payout.commissionAmount;
      bucket.deals.push(deal);
    }
  }

  // Rounded once, at the end, so instalments in paise never leave a figure
  // a fraction of a rupee off.
  const monthly = [...monthlyMap.values()]
    .map((bucket) => ({
      ...bucket,
      total: roundMoney(bucket.total),
      paid: roundMoney(bucket.paid),
      tds: roundMoney(bucket.tds),
      fees: roundMoney(bucket.fees),
      net: roundMoney(bucket.net),
      barter: roundMoney(bucket.barter),
      commission: roundMoney(bucket.commission),
      pending: roundMoney(bucket.pending),
      deals: bucket.deals.map((deal) => ({ ...deal, amount: roundMoney(deal.amount) })),
    }))
    .sort((a, b) => b.month.localeCompare(a.month));
  return {
    total: roundMoney(totals.total),
    paid: roundMoney(totals.paid),
    tds: roundMoney(totals.tds),
    fees: roundMoney(totals.fees),
    net: roundMoney(totals.net),
    barter: roundMoney(totals.barter),
    commission: roundMoney(totals.commission),
    pending: roundMoney(totals.pending),
    monthly,
  };
}

class CampaignsEarningsRepository implements IEarningsRepository {
  async getSummary(): Promise<EarningsSummary> {
    // Affiliate income is additive to the deal book, so a failure to read
    // either affiliate store costs the commission line and not the whole
    // earnings summary, which every page above depends on.
    const [{ campaigns, settledInvoices }, partners, payouts] = await Promise.all([
      readSettledLedger(),
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

    return summarizeEarnings(campaigns, income, settledInvoices);
  }
}

export const earningsRepository: IEarningsRepository = new CampaignsEarningsRepository();
