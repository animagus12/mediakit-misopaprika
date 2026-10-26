import { financialYearStart, financialYearsPresent, toFinancialDayKey } from "@/lib/financialYear";
import type { Campaign, CampaignPaymentStatus } from "@/repositories/campaigns";

/** What a TDS row was withheld from: the deal's own payment, or a usage renewal's. */
export type TdsSource = "deal" | "renewal";

export interface TdsPayment {
  campaignId: string;
  /** The renewal this row is for, or null for the deal's own payment. */
  renewalId: string | null;
  source: TdsSource;
  campaign: string;
  brand: string;
  paidDate: string;
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

// One received payment that carries a TDS record, whichever of a deal's
// payments it is. The deal's own payment and each renewal are separate
// transactions (see UsageRenewalRecord), so each is its own row.
interface TdsBearingPayment {
  campaign: Campaign;
  renewalId: string | null;
  paidDate: string;
  cashAmount: number;
  tdsRate: number | null;
  tdsAmount: number | null;
}

interface TaxablePayment {
  paymentStatus: CampaignPaymentStatus;
  paidDate: string;
  tdsRate: number | null;
  tdsAmount: number | null;
}

function carriesTds(payment: TaxablePayment): boolean {
  if (payment.paymentStatus !== "received" || !payment.paidDate) return false;
  return payment.tdsRate !== null || payment.tdsAmount !== null;
}

function tdsBearingPayments(campaigns: Campaign[]): TdsBearingPayment[] {
  const payments: TdsBearingPayment[] = [];
  for (const campaign of campaigns) {
    if (carriesTds(campaign)) {
      payments.push({
        campaign,
        renewalId: null,
        paidDate: campaign.paidDate,
        // Cash, never barter: tax is withheld from money paid out.
        cashAmount: campaign.cash,
        tdsRate: campaign.tdsRate,
        tdsAmount: campaign.tdsAmount,
      });
    }
    for (const renewal of campaign.usage.renewals) {
      if (!carriesTds(renewal)) continue;
      payments.push({
        campaign,
        renewalId: renewal.id,
        paidDate: renewal.paidDate,
        cashAmount: renewal.amount,
        tdsRate: renewal.tdsRate,
        tdsAmount: renewal.tdsAmount,
      });
    }
  }
  return payments;
}

export function tdsFinancialYears(campaigns: Campaign[], now: Date = new Date()): number[] {
  return financialYearsPresent(
    tdsBearingPayments(campaigns).map((payment) => payment.paidDate),
    now
  );
}

export function summarizeTds(campaigns: Campaign[], year: number): TdsSummary {
  const payments: TdsPayment[] = [];
  for (const payment of tdsBearingPayments(campaigns)) {
    if (financialYearStart(payment.paidDate) !== year) continue;
    const tds = resolveTds(payment.cashAmount, payment.tdsRate, payment.tdsAmount);
    if (!tds) continue;

    payments.push({
      campaignId: payment.campaign.id,
      renewalId: payment.renewalId,
      source: payment.renewalId === null ? "deal" : "renewal",
      campaign: payment.campaign.campaign,
      brand: payment.campaign.brand,
      paidDate: payment.paidDate,
      cashAmount: payment.cashAmount,
      tdsRate: payment.tdsRate,
      tdsAmount: tds.amount,
      estimated: tds.estimated,
    });
  }

  // Day keys sort as plain strings, and read both date formats a paid date
  // can arrive in. Every payment here has one: the year filter above skips
  // any date that does not parse.
  payments.sort(
    (a, b) =>
      (toFinancialDayKey(b.paidDate) ?? "").localeCompare(toFinancialDayKey(a.paidDate) ?? "") ||
      a.brand.localeCompare(b.brand)
  );

  const brandMap = new Map<string, TdsBrandTotal>();
  for (const payment of payments) {
    const key = payment.brand.trim() || "Unknown brand";
    const total = brandMap.get(key) ?? { brand: key, paymentCount: 0, tdsAmount: 0 };
    total.paymentCount += 1;
    total.tdsAmount += payment.tdsAmount;
    brandMap.set(key, total);
  }

  return {
    payments,
    brands: [...brandMap.values()].sort(
      (a, b) => b.tdsAmount - a.tdsAmount || a.brand.localeCompare(b.brand)
    ),
    totalCash: payments.reduce((total, payment) => total + payment.cashAmount, 0),
    totalTds: payments.reduce((total, payment) => total + payment.tdsAmount, 0),
  };
}
