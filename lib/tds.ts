import { financialYearStart, financialYearsPresent, toFinancialDayKey } from "@/lib/financialYear";
import type { Campaign } from "@/repositories/campaigns";

export interface TdsPayment {
  campaignId: string;
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

export function tdsFinancialYears(campaigns: Campaign[], now: Date = new Date()): number[] {
  const paidDates: string[] = [];
  for (const campaign of campaigns) {
    if (campaign.paymentStatus !== "received" || !campaign.paidDate) continue;
    if (campaign.tdsRate === null && campaign.tdsAmount === null) continue;
    paidDates.push(campaign.paidDate);
  }
  return financialYearsPresent(paidDates, now);
}

export function summarizeTds(campaigns: Campaign[], year: number): TdsSummary {
  const payments: TdsPayment[] = [];
  for (const campaign of campaigns) {
    if (campaign.paymentStatus !== "received" || !campaign.paidDate) continue;
    if (financialYearStart(campaign.paidDate) !== year) continue;
    if (campaign.tdsRate === null && campaign.tdsAmount === null) continue;

    const estimated = campaign.tdsAmount === null;
    const tdsAmount =
      campaign.tdsAmount ?? calculateTdsAmount(campaign.cash, campaign.tdsRate ?? 0);
    payments.push({
      campaignId: campaign.id,
      campaign: campaign.campaign,
      brand: campaign.brand,
      paidDate: campaign.paidDate,
      cashAmount: campaign.cash,
      tdsRate: campaign.tdsRate,
      tdsAmount,
      estimated,
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
