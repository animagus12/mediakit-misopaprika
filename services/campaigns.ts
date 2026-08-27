import "server-only";
import {
  appendSheetRow,
  fetchSheetRows,
  getSheetGid,
  setOneOfListValidation,
  updateSheetRange,
} from "./googleSheets";
import { REEL_OPTIONS, STORY_OPTIONS, STATUS_OPTIONS, COLLABORATION_TYPES } from "@/lib/collaborations";

// The sheet's own Type dropdown also allows "Scam" (for deals that turned
// out to be one) — not offered in the quick-add form, but the validation
// rule attached to new cells should still match the sheet's real list.
const TYPE_DROPDOWN_OPTIONS = [...COLLABORATION_TYPES, "Scam"];

// One row of the campaigns sheet — same tab the earnings overview reads
// (see repositories/earnings.ts), just projected differently: brand,
// deliverables, and pipeline status rather than money.
export interface CampaignRow {
  campaignId: string;
  brand: string;
  campaign: string;
  type: string;
  reels: string;
  story: string;
  status: string;
  date: string;
  amount: number;
  barterValue: number;
  total: number;
}

export interface NewCampaignInput {
  date: string;
  brand: string;
  campaign: string;
  type: string;
  reels: string;
  story: string;
  status: string;
  amount: number;
  barterValue: number;
}

export interface CampaignUpdate extends NewCampaignInput {
  campaignId: string;
}

function parseAmount(raw: string | undefined): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/[^0-9.-]/g, "");
  return cleaned ? Number(cleaned) || 0 : 0;
}

// 0-based column index -> spreadsheet letter ("A", "B", … "Z", "AA", …).
function columnLetter(index: number): string {
  let letter = "";
  let n = index + 1;
  while (n > 0) {
    const remainder = (n - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}

// Finds the highest existing "<prefix><digits>" id and returns the next one,
// zero-padded to at least 4 digits to match the sheet's existing style.
function nextSequenceId(existingIds: string[], prefix: string): string {
  const pattern = new RegExp(`^${prefix}(\\d+)$`);
  let max = 0;
  for (const id of existingIds) {
    const match = id.trim().match(pattern);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

function getSheetConfig(): { sheetId: string; tab: string } {
  const sheetId = process.env.EARNINGS_SHEET_ID;
  const tab = process.env.EARNINGS_SHEET_TAB;
  if (!sheetId || !tab) {
    throw new Error("EARNINGS_SHEET_ID and EARNINGS_SHEET_TAB must be set");
  }
  return { sheetId, tab };
}

export async function fetchCampaigns(): Promise<CampaignRow[]> {
  const { sheetId, tab } = getSheetConfig();

  const rows = await fetchSheetRows(sheetId, tab);
  const [header, ...body] = rows;
  if (!header) return [];

  const columnIndex = (name: string) => header.findIndex((h) => h.trim() === name);
  const campaignIdCol = columnIndex("Campaign ID");
  const dateCol = columnIndex("Date");
  const brandCol = columnIndex("Brand");
  const campaignCol = columnIndex("Campaign");
  const typeCol = columnIndex("Type");
  const reelsCol = columnIndex("Reels");
  const storyCol = columnIndex("Story");
  const statusCol = columnIndex("Status");
  const amountCol = columnIndex("Amount");
  const barterCol = columnIndex("Barter Value");
  const totalCol = columnIndex("Total");

  return body
    .filter((row) => row[brandCol]?.trim())
    .map((row) => ({
      campaignId: row[campaignIdCol] ?? "",
      brand: row[brandCol] ?? "",
      campaign: row[campaignCol] ?? "",
      type: row[typeCol] ?? "",
      reels: row[reelsCol] ?? "",
      story: row[storyCol] ?? "",
      status: row[statusCol] ?? "",
      date: row[dateCol] ?? "",
      amount: parseAmount(row[amountCol]),
      barterValue: parseAmount(row[barterCol]),
      total: parseAmount(row[totalCol]),
    }));
}

// Appends a new deal to the sheet, placing each field by header name so a
// reordered/extended sheet doesn't silently write into the wrong column.
// Columns this quick-add doesn't collect (Upload Dt, Invoice, Payment,
// Payment Method, Notes) are left blank for the creator to fill in once the
// deal actually happens. Campaign ID / Invoice ID are auto-assigned below;
// Total is patched in as a live formula after the append (see below).
export async function appendCampaign(input: NewCampaignInput): Promise<void> {
  const { sheetId, tab } = getSheetConfig();

  const rows = await fetchSheetRows(sheetId, tab);
  const [header, ...body] = rows;
  if (!header) throw new Error("Sheet has no header row");

  const columnIndex = (name: string) => header.findIndex((h) => h.trim() === name);
  const campaignIdCol = columnIndex("Campaign ID");
  const invoiceIdCol = columnIndex("Invoice ID");
  const typeCol = columnIndex("Type");
  const reelsCol = columnIndex("Reels");
  const storyCol = columnIndex("Story");
  const statusCol = columnIndex("Status");
  const amountCol = columnIndex("Amount");
  const barterCol = columnIndex("Barter Value");
  const totalCol = columnIndex("Total");

  // MC (monetary campaign) gets an invoice; BC (barter campaign) doesn't —
  // matches the sheet's own "MSP-BC0001" / "MSP-MC0001" + "MSP-INV-0001" convention.
  const hasPaidComponent = input.type === "Paid" || input.type === "Barter+Paid";
  const campaignId = nextSequenceId(
    campaignIdCol >= 0 ? body.map((r) => r[campaignIdCol] ?? "") : [],
    hasPaidComponent ? "MSP-MC" : "MSP-BC"
  );
  const invoiceId = hasPaidComponent
    ? nextSequenceId(invoiceIdCol >= 0 ? body.map((r) => r[invoiceIdCol] ?? "") : [], "MSP-INV-")
    : "-";

  const row = new Array(header.length).fill("");
  const setColumn = (name: string, value: string) => {
    const index = columnIndex(name);
    if (index >= 0) row[index] = value;
  };

  setColumn("Campaign ID", campaignId);
  setColumn("Invoice ID", invoiceId);
  setColumn("Date", input.date);
  setColumn("Brand", input.brand);
  setColumn("Campaign", input.campaign);
  setColumn("Type", input.type);
  setColumn("Reels", input.reels);
  setColumn("Story", input.story);
  setColumn("Status", input.status);
  if (input.amount > 0) setColumn("Amount", String(input.amount));
  if (input.barterValue > 0) setColumn("Barter Value", String(input.barterValue));

  const updatedRange = await appendSheetRow(sheetId, tab, row);
  const rowMatch = updatedRange.match(/![A-Z]+(\d+)/);
  const rowIndex0 = rowMatch ? Number(rowMatch[1]) - 1 : null; // 0-based, for batchUpdate ranges

  // Every existing row computes Total as "=SUM(K{row}, L{row})" rather than a
  // static number, so it stays correct if Amount/Barter Value are edited
  // later — match that instead of writing a number that'd fall out of sync.
  if (rowMatch && totalCol >= 0 && amountCol >= 0 && barterCol >= 0 && (input.amount > 0 || input.barterValue > 0)) {
    const rowNumber = rowMatch[1];
    const formula = `=SUM(${columnLetter(amountCol)}${rowNumber}, ${columnLetter(barterCol)}${rowNumber})`;
    await updateSheetRange(sheetId, `${tab}!${columnLetter(totalCol)}${rowNumber}`, [[formula]]);
  }

  // values.append/update never attaches the sheet's dropdown validation to a
  // newly-written cell, so without this the row renders as plain text instead
  // of the colored chip dropdown every other row has (the chip look is the
  // Sheets UI's own rendering of the validation rule, not a stored color).
  if (rowIndex0 !== null) {
    const gid = await getSheetGid(sheetId, tab);
    const cellRange = (col: number) => ({
      sheetId: gid,
      startRowIndex: rowIndex0,
      endRowIndex: rowIndex0 + 1,
      startColumnIndex: col,
      endColumnIndex: col + 1,
    });
    const rules = [
      typeCol >= 0 && { range: cellRange(typeCol), values: TYPE_DROPDOWN_OPTIONS },
      reelsCol >= 0 && { range: cellRange(reelsCol), values: REEL_OPTIONS },
      storyCol >= 0 && { range: cellRange(storyCol), values: STORY_OPTIONS },
      statusCol >= 0 && { range: cellRange(statusCol), values: STATUS_OPTIONS },
    ].filter((rule): rule is { range: ReturnType<typeof cellRange>; values: string[] } => Boolean(rule));
    if (rules.length > 0) await setOneOfListValidation(sheetId, rules);
  }
}

// Overwrites the row matching campaignId in a single range write, so columns
// this form doesn't collect (Upload Dt, Invoice ID, Payment, Payment Method,
// Notes, …) — and the cell-level dropdown validation already attached to an
// existing row — are left exactly as they were.
export async function updateCampaign(input: CampaignUpdate): Promise<void> {
  const { sheetId, tab } = getSheetConfig();

  const rows = await fetchSheetRows(sheetId, tab);
  const [header, ...body] = rows;
  if (!header) throw new Error("Sheet has no header row");

  const columnIndex = (name: string) => header.findIndex((h) => h.trim() === name);
  const campaignIdCol = columnIndex("Campaign ID");
  if (campaignIdCol < 0) throw new Error('"Campaign ID" column not found');

  const rowIndex0 = body.findIndex((r) => r[campaignIdCol] === input.campaignId);
  if (rowIndex0 < 0) throw new Error(`Campaign "${input.campaignId}" not found in the sheet`);
  const rowNumber = rowIndex0 + 2; // +1 for the header row, +1 to go 0-based -> 1-based

  const row = [...body[rowIndex0]];
  while (row.length < header.length) row.push("");

  const setColumn = (name: string, value: string) => {
    const index = columnIndex(name);
    if (index >= 0) row[index] = value;
  };

  setColumn("Date", input.date);
  setColumn("Brand", input.brand);
  setColumn("Campaign", input.campaign);
  setColumn("Type", input.type);
  setColumn("Reels", input.reels);
  setColumn("Story", input.story);
  setColumn("Status", input.status);
  setColumn("Amount", input.amount > 0 ? String(input.amount) : "");
  setColumn("Barter Value", input.barterValue > 0 ? String(input.barterValue) : "");

  // Same live-formula convention as appendCampaign, recomputed here since
  // editing may turn a barter-only deal into a paid one (or vice versa).
  const amountCol = columnIndex("Amount");
  const barterCol = columnIndex("Barter Value");
  const totalCol = columnIndex("Total");
  if (totalCol >= 0 && amountCol >= 0 && barterCol >= 0) {
    row[totalCol] =
      input.amount > 0 || input.barterValue > 0
        ? `=SUM(${columnLetter(amountCol)}${rowNumber}, ${columnLetter(barterCol)}${rowNumber})`
        : "";
  }

  await updateSheetRange(sheetId, `${tab}!A${rowNumber}:${columnLetter(header.length - 1)}${rowNumber}`, [row]);
}

// Writes just the "Payment" column for the row matching campaignId, leaving
// every other cell (and its dropdown validation) untouched. Powers the
// dashboard's one-click "Mark received" action on the payments-due list;
// readers (repositories/earnings.ts, repositories/brandCampaigns.ts) match
// this column case-insensitively, so "Received" / "No" round-trip cleanly.
export async function setCampaignPayment(campaignId: string, value: string): Promise<void> {
  const { sheetId, tab } = getSheetConfig();

  const rows = await fetchSheetRows(sheetId, tab);
  const [header, ...body] = rows;
  if (!header) throw new Error("Sheet has no header row");

  const columnIndex = (name: string) => header.findIndex((h) => h.trim() === name);
  const campaignIdCol = columnIndex("Campaign ID");
  if (campaignIdCol < 0) throw new Error('"Campaign ID" column not found');
  const paymentCol = columnIndex("Payment");
  if (paymentCol < 0) throw new Error('"Payment" column not found');

  const rowIndex0 = body.findIndex((r) => r[campaignIdCol] === campaignId);
  if (rowIndex0 < 0) throw new Error(`Campaign "${campaignId}" not found in the sheet`);
  const rowNumber = rowIndex0 + 2; // +1 for the header row, +1 to go 0-based -> 1-based

  await updateSheetRange(sheetId, `${tab}!${columnLetter(paymentCol)}${rowNumber}`, [[value]]);
}
