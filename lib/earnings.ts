import type { MonthlyEarnings } from "@/repositories/earnings";

export function monthLabel(month: string): string {
  const [year, monthNum] = month.split("-");
  const date = new Date(Number(year), Number(monthNum) - 1, 1);
  return date.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

export function currentMonthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

// "YYYY-MM" strings compare chronologically as plain strings.
export function monthsAgoKey(count: number): string {
  const now = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth() - count, 1);
  return `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}`;
}

function monthlyTotal(monthly: MonthlyEarnings[], key: string): number {
  return monthly.find((m) => m.month === key)?.total ?? 0;
}

// null when there's no prior month to compare against, so callers can hide the trend
// instead of showing a misleading divide-by-zero percentage.
export function computeMonthTrend(monthly: MonthlyEarnings[]): number | null {
  const current = monthlyTotal(monthly, currentMonthKey());
  const previous = monthlyTotal(monthly, monthsAgoKey(1));
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}
