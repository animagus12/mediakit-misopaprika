import { todayKey } from "@/lib/day";
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

export function financialYearStart(date: string): number | null {
  const match = date.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, dayText, monthText, yearText] = match;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return month >= 4 ? year : year - 1;
}

export function currentFinancialYearStart(now: Date = new Date()): number {
  const [year, month] = todayKey(now).split("-").map(Number);
  return month >= 4 ? year : year - 1;
}

export function tdsFinancialYears(campaigns: Campaign[], now: Date = new Date()): number[] {
  const years = new Set<number>([currentFinancialYearStart(now)]);
  for (const campaign of campaigns) {
    if (campaign.paymentStatus !== "received" || !campaign.paidDate) continue;
    if (campaign.tdsRate === null && campaign.tdsAmount === null) continue;
    const year = financialYearStart(campaign.paidDate);
    if (year !== null) years.add(year);
  }
  return [...years].sort((a, b) => b - a);
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

  payments.sort((a, b) => {
    const [aDay, aMonth, aYear] = a.paidDate.split("/").map(Number);
    const [bDay, bMonth, bYear] = b.paidDate.split("/").map(Number);
    return bYear - aYear || bMonth - aMonth || bDay - aDay || a.brand.localeCompare(b.brand);
  });

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
