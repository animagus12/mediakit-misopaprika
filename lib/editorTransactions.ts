// Exact values the quick-add form offers for Status. Kept client-safe (no
// "server-only") since the form renders these as <Select> options.
export const EDITOR_TRANSACTION_STATUS_OPTIONS = ["Paid", "Pending", "Cancelled"];

// Most transactions currently go to this editor, so new ones default here
// instead of forcing a re-pick every time; falls back to the first editor
// in the roster if this one isn't in it.
export const DEFAULT_EDITOR_NAME = "Divyanshu Raj";

// Sheet-style dates are DD/MM/YYYY; <input type="date"> gives/needs yyyy-mm-dd.
export function toSheetDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return isoDate;
  return `${day}/${month}/${year}`;
}

// Inverse of toSheetDate, for prefilling an edit form's <input type="date">
// from a value read back out of storage. Returns "" when unparsable so
// callers can fall back to a sensible default instead of feeding the <input>
// a value it will silently reject.
export function toIsoDate(sheetDate: string): string {
  const match = sheetDate.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return "";
  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

// Timestamp for a DD/MM/YYYY sheet-style date, for sorting/diffing. NaN for
// anything unparsable, which Array.prototype.sort treats as "always last".
export function parseSheetDate(date: string): number {
  const match = date.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return Number.NaN;
  const [, day, month, year] = match;
  return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
}

// Turnaround time in days between the assigned date and the delivered date.
// Derived rather than stored so it can never drift out of sync with the
// two dates it's computed from.
export function computeEtaDays(videoDate: string, deliveryDate: string): number {
  const start = parseSheetDate(videoDate);
  const end = parseSheetDate(deliveryDate);
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.round((end - start) / 86_400_000);
}

export interface EditorTransactionStats {
  count: number;
  totalAmount: number;
  editorCount: number;
  avgEtaDays: number;
}

export function computeEditorTransactionStats(
  items: { amount: number | null; editor: string; etaDays: number }[]
): EditorTransactionStats {
  const totalAmount = items.reduce((sum, item) => sum + (item.amount ?? 0), 0);
  const editorCount = new Set(items.map((item) => item.editor.trim().toLowerCase())).size;
  const avgEtaDays = items.length
    ? Math.round((items.reduce((sum, item) => sum + item.etaDays, 0) / items.length) * 10) / 10
    : 0;
  return { count: items.length, totalAmount, editorCount, avgEtaDays };
}

export interface EditorPayoutSummary {
  paid: number;
  pending: number;
}

// Sums what's actually owed to one editor. A "Cancelled" transaction never
// happened commercially, so it counts toward neither figure: same
// convention as the earnings overview's handling of cancelled deals.
export function computeEditorPayoutSummary(
  editorName: string,
  transactions: { editor: string; amount: number | null; status: string }[]
): EditorPayoutSummary {
  let paid = 0;
  let pending = 0;
  for (const txn of transactions) {
    if (txn.editor !== editorName) continue;
    const amount = txn.amount ?? 0;
    switch (txn.status.trim().toLowerCase()) {
      case "paid":
        paid += amount;
        break;
      case "pending":
        pending += amount;
        break;
    }
  }
  return { paid, pending };
}
