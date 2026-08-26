import "server-only";
import { fetchSheetRows } from "@/services/googleSheets";

export interface MonthlyEarnings {
  month: string; // "YYYY-MM"
  total: number;
  paid: number;
  barter: number;
  pending: number;
}

export interface EarningsSummary {
  total: number;
  paid: number;
  barter: number;
  pending: number;
  monthly: MonthlyEarnings[]; // ascending by month
}

export interface IEarningsRepository {
  getSummary(): Promise<EarningsSummary>;
}

function parseAmount(raw: string | undefined): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/[^0-9.-]/g, "");
  return cleaned ? Number(cleaned) || 0 : 0;
}

// Sheet dates are DD/MM/YYYY. Returns a "YYYY-MM" bucket key, or null when blank/unparsable.
// Callers fall back from Upload Dt to Date when the upload date is blank.
function monthKey(raw: string | undefined): string | null {
  const match = raw?.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, , month, year] = match;
  return `${year}-${month.padStart(2, "0")}`;
}

// A deal counts toward earnings once the value has actually been received —
// the sheet's Status column tracks delivery/campaign progress (Completed,
// Cancelled, Todo, ...) which is a different axis from whether payment/barter
// was collected, so we key off the Payment column instead.
function isReceived(raw: string | undefined): boolean {
  return raw?.trim().toLowerCase().startsWith("rec") ?? false;
}

// "No" means still owed and expected — distinct from a written-off value
// (e.g. the sheet's "Scam" entries), which should never surface as pending.
function isPending(raw: string | undefined): boolean {
  return raw?.trim().toLowerCase() === "no";
}

// A cancelled deal never happened commercially — excluded from every stat
// (received, pending, monthly), not just netted out of "pending".
function isCancelled(raw: string | undefined): boolean {
  return raw?.trim().toLowerCase() === "cancelled";
}

class SheetsEarningsRepository implements IEarningsRepository {
  async getSummary(): Promise<EarningsSummary> {
    const sheetId = process.env.EARNINGS_SHEET_ID;
    const tab = process.env.EARNINGS_SHEET_TAB;
    if (!sheetId || !tab) {
      throw new Error("EARNINGS_SHEET_ID and EARNINGS_SHEET_TAB must be set");
    }

    const rows = await fetchSheetRows(sheetId, tab);
    const [header, ...body] = rows;
    if (!header) return { total: 0, paid: 0, barter: 0, pending: 0, monthly: [] };

    const columnIndex = (name: string) => header.findIndex((h) => h.trim() === name);
    const uploadDateCol = columnIndex("Upload Dt");
    const dateCol = columnIndex("Date");
    const amountCol = columnIndex("Amount");
    const barterCol = columnIndex("Barter Value");
    const totalCol = columnIndex("Total");
    const paymentCol = columnIndex("Payment");
    const statusCol = columnIndex("Status");

    const monthlyMap = new Map<string, MonthlyEarnings>();
    let total = 0;
    let paid = 0;
    let barter = 0;
    let pending = 0;

    for (const row of body) {
      if (isCancelled(row[statusCol])) continue;

      const rowTotal = parseAmount(row[totalCol]);
      const key = monthKey(row[uploadDateCol]) ?? monthKey(row[dateCol]);

      if (isPending(row[paymentCol])) {
        pending += rowTotal;
        if (key) {
          const bucket = monthlyMap.get(key) ?? { month: key, total: 0, paid: 0, barter: 0, pending: 0 };
          bucket.pending += rowTotal;
          monthlyMap.set(key, bucket);
        }
        continue;
      }
      if (!isReceived(row[paymentCol])) continue;

      const rowAmount = parseAmount(row[amountCol]);
      const rowBarter = parseAmount(row[barterCol]);

      total += rowTotal;
      paid += rowAmount;
      barter += rowBarter;

      if (key) {
        const bucket = monthlyMap.get(key) ?? { month: key, total: 0, paid: 0, barter: 0, pending: 0 };
        bucket.total += rowTotal;
        bucket.paid += rowAmount;
        bucket.barter += rowBarter;
        monthlyMap.set(key, bucket);
      }
    }

    const monthly = [...monthlyMap.values()].sort((a, b) => a.month.localeCompare(b.month));
    return { total, paid, barter, pending, monthly };
  }
}

export const earningsRepository: IEarningsRepository = new SheetsEarningsRepository();
