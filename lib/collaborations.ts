import type { Collaboration } from "@/repositories/collaborations";

export type CollaborationType = "Barter" | "Paid" | "Barter+Paid";

// Exact values the sheet's data-validation dropdowns accept for each column
// (Google Sheets rejects anything outside the list for these cells) — kept
// client-safe (no "server-only") since the quick-add form renders these as
// <Select> options, so it and the sheet can't drift apart. "Scam" is a valid
// Type in the sheet but isn't offered when adding a new deal; it's something
// you'd mark after the fact.
export const COLLABORATION_TYPES: CollaborationType[] = ["Barter", "Paid", "Barter+Paid"];
export const REEL_OPTIONS = ["1 Reel", "2 Reels", "5 Reels"];
export const STORY_OPTIONS = ["1 Story", "2 Story", "5 Stories", "None"];
export const STATUS_OPTIONS = [
  "Discussion",
  "In Route",
  "Brainstorming",
  "Todo",
  "Ready to Upload",
  "Completed",
  "Cancelled",
  "Redacted",
];

// Sheet dates are entered as "DD/MM/YYYY"; undated rows sort last.
function parseSheetDate(date: string): number {
  const match = date.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return Number.NEGATIVE_INFINITY;
  const [, day, month, year] = match;
  return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
}

// The sheet's dates are DD/MM/YYYY; <input type="date"> gives/needs yyyy-mm-dd.
export function toSheetDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return isoDate;
  return `${day}/${month}/${year}`;
}

// Inverse of toSheetDate, for prefilling an edit form's <input type="date">
// from a value read back out of the sheet. Returns "" when unparsable so
// callers can fall back to a sensible default instead of feeding the <input>
// a value it will silently reject.
export function toIsoDate(sheetDate: string): string {
  const match = sheetDate.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return "";
  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export interface SplitCollaborations {
  active: Collaboration[];
  past: Collaboration[];
}

export function splitCollaborations(items: Collaboration[]): SplitCollaborations {
  const active = items
    .filter((item) => item.stage === "active")
    .sort((a, b) => parseSheetDate(a.date) - parseSheetDate(b.date));
  const past = items
    .filter((item) => item.stage === "past")
    .sort((a, b) => parseSheetDate(b.date) - parseSheetDate(a.date));
  return { active, past };
}

export interface CollaborationStats {
  total: number;
  paid: number;
  barter: number;
  cancelled: number;
  highestValue: Collaboration | null;
}

export function computeCollaborationStats(items: Collaboration[]): CollaborationStats {
  let paid = 0;
  let barter = 0;
  let cancelled = 0;
  let highestValue: Collaboration | null = null;

  for (const item of items) {
    if (item.status.trim().toLowerCase() === "cancelled") {
      cancelled += 1;
      continue;
    }
    const type = item.type.trim().toLowerCase();
    if (type.includes("paid")) paid += 1;
    if (type.includes("barter")) barter += 1;
    if (!highestValue || item.total > highestValue.total) highestValue = item;
  }

  return { total: items.length - cancelled, paid, barter, cancelled, highestValue };
}
