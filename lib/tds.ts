import { financialYearStart, financialYearsPresent } from "@/lib/financialYear";
import { roundMoney, sumMoney } from "@/lib/money";
import type { Campaign } from "@/repositories/campaigns";
import type { LedgerEntry, Settlement } from "@/repositories/payments";

/** What a TDS row was withheld from: the deal's own payment, or a usage renewal's. */
export type TdsSource = "deal" | "renewal";

export interface TdsPayment {
  /** The ledger entry this row is: a recorded payment's id, or a legacy one's virtual id. */
  paymentId: string;
  campaignId: string;
  /** The renewal this row is for, or null for the deal's own payment. */
  renewalId: string | null;
  source: TdsSource;
  campaign: string;
  brand: string;
  /** The day the money arrived, as a yyyy-mm-dd day key. */
  paidDate: string;
  /** The amount settled by this payment, TDS included. */
  gross: number;
  /** Same as `gross`: kept so the page and the totals read one name. */
  cashAmount: number;
  tdsRate: number | null;
  tdsAmount: number;
  estimated: boolean;
}

export interface TdsBrandTotal {
  brand: string;
  paymentCount: number;
  tdsAmount: number;
}

export interface TdsSummary {
  payments: TdsPayment[];
  brands: TdsBrandTotal[];
  totalCash: number;
  totalTds: number;
}

export function calculateTdsAmount(cashAmount: number, rate: number): number {
  if (!Number.isFinite(cashAmount) || !Number.isFinite(rate) || cashAmount <= 0 || rate <= 0) {
    return 0;
  }
  return Math.round((cashAmount * rate) / 100);
}

export function validateTdsValues(
  rate: number | null | undefined,
  amount: number | null | undefined
): string | null {
  if (rate != null && (!Number.isFinite(rate) || rate < 0 || rate > 100)) {
    return "TDS rate must be between 0 and 100 percent";
  }
  if (amount != null && (!Number.isFinite(amount) || amount < 0)) {
    return "Actual TDS must be a non-negative amount";
  }
  return null;
}

/**
 * The TDS a payment records: the actual amount when one was entered, otherwise
 * the rate's estimate on `cashAmount`. null when neither was recorded.
 */
export function resolveTds(
  cashAmount: number,
  tdsRate: number | null,
  tdsAmount: number | null
): { amount: number; estimated: boolean } | null {
  if (tdsAmount !== null) return { amount: tdsAmount, estimated: false };
  if (tdsRate === null) return null;
  return { amount: calculateTdsAmount(cashAmount, tdsRate), estimated: true };
}

/**
 * The estimate a form shows beside its TDS inputs: `gross` at the rate typed
 * so far, or null while the rate is blank or outside 0 to 100.
 */
export function estimateTdsFromRateInput(rateText: string, gross: number): number | null {
  if (!rateText.trim()) return null;
  const rate = Number(rateText);
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) return null;
  return calculateTdsAmount(gross, rate);
}

/** A TDS form field as a stored value: blank is null, anything else a number. */
export function parseTdsInput(text: string): number | null {
  return text.trim() ? Number(text) : null;
}

// One payment that carries a TDS record: an entry in a deal's or a renewal's
// settlement (lib/payments.ts). A deal paid in instalments has a row per
// instalment, each filed by the day it arrived; the deal's own payment and
// each renewal are separate transactions (see UsageRenewalRecord).
interface TdsBearingPayment {
  campaign: Campaign;
  renewalId: string | null;
  entry: LedgerEntry;
  tdsRate: number | null;
}

// A dated entry only: a payment with no known day belongs to no financial
// year. A recorded payment counts once it withheld something; a legacy entry
// (a deal marked received before the ledger) counts whenever its deal had a
// TDS rate or amount on it, as it always has, estimate included.
function carriesTds(entry: LedgerEntry, tdsRate: number | null, tdsAmount: number | null): boolean {
  if (!entry.date) return false;
  if (entry.source === "stored") return entry.tds > 0;
  return entry.legacyKind === "status" && (tdsRate !== null || tdsAmount !== null);
}

function collect(
  out: TdsBearingPayment[],
  campaign: Campaign,
  renewalId: string | null,
  settlement: Settlement | null,
  tdsRate: number | null,
  tdsAmount: number | null
) {
  for (const entry of settlement?.entries ?? []) {
    if (carriesTds(entry, tdsRate, tdsAmount)) out.push({ campaign, renewalId, entry, tdsRate });
  }
}

function tdsBearingPayments(campaigns: Campaign[]): TdsBearingPayment[] {
  const payments: TdsBearingPayment[] = [];
  for (const campaign of campaigns) {
    // Cash, never barter: tax is withheld from money paid out, and only a
    // deal with a cash half has a settlement.
    collect(payments, campaign, null, campaign.settlement, campaign.tdsRate, campaign.tdsAmount);
    for (const renewal of campaign.usage.renewals) {
      collect(payments, campaign, renewal.id, renewal.settlement, renewal.tdsRate, renewal.tdsAmount);
    }
  }
  return payments;
}

export function tdsFinancialYears(campaigns: Campaign[], now: Date = new Date()): number[] {
  return financialYearsPresent(
    tdsBearingPayments(campaigns).map((payment) => payment.entry.date),
    now
  );
}

export function summarizeTds(campaigns: Campaign[], year: number): TdsSummary {
  const payments: TdsPayment[] = [];
  for (const { campaign, renewalId, entry, tdsRate } of tdsBearingPayments(campaigns)) {
    if (financialYearStart(entry.date) !== year) continue;

    payments.push({
      paymentId: entry.id,
      campaignId: campaign.id,
      renewalId,
      source: renewalId === null ? "deal" : "renewal",
      campaign: campaign.campaign,
      brand: campaign.brand,
      paidDate: entry.date,
      gross: entry.gross,
      cashAmount: entry.gross,
      tdsRate,
      tdsAmount: entry.tds,
      estimated: entry.tdsEstimated,
    });
  }

  // Ledger dates are day keys, which sort as plain strings.
  payments.sort((a, b) => b.paidDate.localeCompare(a.paidDate) || a.brand.localeCompare(b.brand));

  const brandMap = new Map<string, TdsBrandTotal>();
  for (const payment of payments) {
    const key = payment.brand.trim() || "Unknown brand";
    const total = brandMap.get(key) ?? { brand: key, paymentCount: 0, tdsAmount: 0 };
    total.paymentCount += 1;
    total.tdsAmount = roundMoney(total.tdsAmount + payment.tdsAmount);
    brandMap.set(key, total);
  }

  return {
    payments,
    brands: [...brandMap.values()].sort(
      (a, b) => b.tdsAmount - a.tdsAmount || a.brand.localeCompare(b.brand)
    ),
    totalCash: sumMoney(payments.map((payment) => payment.cashAmount)),
    totalTds: sumMoney(payments.map((payment) => payment.tdsAmount)),
  };
}
