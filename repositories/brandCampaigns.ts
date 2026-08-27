import "server-only";
import { fetchSheetRows } from "@/services/googleSheets";

export type BrandCampaignPaymentStatus = "received" | "pending" | "unknown";

// One row of the Campaigns sheet, projected for the brand CRM's Campaigns/
// Payments tabs — same tab repositories/collaborations.ts and
// repositories/earnings.ts read, just carrying the invoice/payment columns
// neither of those projections needs.
export interface BrandCampaignRecord {
  campaignId: string;
  brand: string;
  campaign: string;
  deliverables: string; // e.g. "1 Reel, 1 Story"
  date: string; // DD/MM/YYYY — deal date
  uploadDate: string; // DD/MM/YYYY — actual delivery date, often blank until posted
  status: string; // pipeline status: Discussion/Todo/Completed/Cancelled/...
  amount: number;
  barterValue: number;
  total: number;
  invoiceId: string;
  paymentStatus: BrandCampaignPaymentStatus;
  paymentDue: string; // DD/MM/YYYY the payment is expected by, or "" when unset
  paymentMethod: string;
  notes: string;
}

function parseAmount(raw: string | undefined): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/[^0-9.-]/g, "");
  return cleaned ? Number(cleaned) || 0 : 0;
}

// Same Payment-column convention as repositories/earnings.ts: "Status" is
// pipeline progress, "Payment" is a separate received/pending/blank axis.
function isReceived(raw: string | undefined): boolean {
  return raw?.trim().toLowerCase().startsWith("rec") ?? false;
}

function isPending(raw: string | undefined): boolean {
  return raw?.trim().toLowerCase() === "no";
}

// The Payment Due column mostly holds a DD/MM/YYYY date, but some rows use it
// as a free-text "chase this?" flag ("Yes"/"No"/"-"). Only a real date is
// useful downstream (reminders, sorting), so anything else normalizes to "".
function parseDueDate(raw: string | undefined): string {
  const trimmed = raw?.trim() ?? "";
  return /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed) ? trimmed : "";
}

export async function fetchBrandCampaignRecords(): Promise<BrandCampaignRecord[]> {
  const sheetId = process.env.EARNINGS_SHEET_ID;
  const tab = process.env.EARNINGS_SHEET_TAB;
  if (!sheetId || !tab) {
    throw new Error("EARNINGS_SHEET_ID and EARNINGS_SHEET_TAB must be set");
  }

  const rows = await fetchSheetRows(sheetId, tab);
  const [header, ...body] = rows;
  if (!header) return [];

  const columnIndex = (name: string) => header.findIndex((h) => h.trim() === name);
  const campaignIdCol = columnIndex("Campaign ID");
  const dateCol = columnIndex("Date");
  const brandCol = columnIndex("Brand");
  const campaignCol = columnIndex("Campaign");
  const reelsCol = columnIndex("Reels");
  const storyCol = columnIndex("Story");
  const statusCol = columnIndex("Status");
  const amountCol = columnIndex("Amount");
  const barterCol = columnIndex("Barter Value");
  const totalCol = columnIndex("Total");
  const uploadDateCol = columnIndex("Upload Dt");
  const invoiceIdCol = columnIndex("Invoice ID");
  const paymentDueCol = columnIndex("Payment Due");
  const paymentCol = columnIndex("Payment");
  const paymentMethodCol = columnIndex("Payment Method");
  const notesCol = columnIndex("Notes");

  return body
    .filter((row) => row[brandCol]?.trim())
    .map((row) => ({
      campaignId: row[campaignIdCol] ?? "",
      brand: row[brandCol] ?? "",
      campaign: row[campaignCol] ?? "",
      deliverables: [row[reelsCol], row[storyCol]].filter(Boolean).join(", "),
      date: row[dateCol] ?? "",
      uploadDate: row[uploadDateCol] ?? "",
      status: row[statusCol] ?? "",
      amount: parseAmount(row[amountCol]),
      barterValue: parseAmount(row[barterCol]),
      total: parseAmount(row[totalCol]),
      invoiceId: row[invoiceIdCol] ?? "",
      paymentStatus: isPending(row[paymentCol]) ? "pending" : isReceived(row[paymentCol]) ? "received" : "unknown",
      paymentDue: parseDueDate(row[paymentDueCol]),
      paymentMethod: row[paymentMethodCol] ?? "",
      notes: row[notesCol] ?? "",
    }));
}
