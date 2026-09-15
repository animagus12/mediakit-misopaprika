// Exact values the quick-add form offers for Status. Kept client-safe (no
// "server-only") since the form renders these as <Select> options.
export const EDITOR_TRANSACTION_STATUS_OPTIONS = ["Paid", "Pending", "Cancelled"];

// Most transactions currently go to this editor, so new ones default here
// instead of forcing a re-pick every time; falls back to the first editor
// in the roster if this one isn't in it.
export const DEFAULT_EDITOR_NAME = "Divyanshu Raj";

// A new transaction is logged when the cut is assigned, so it starts unpaid
// at the current flat per-video rate. Both stay editable in the form.
export const DEFAULT_EDITOR_TRANSACTION_STATUS = "Pending";
export const DEFAULT_EDITOR_TRANSACTION_AMOUNT = 400;

export function isEditorTransactionStatus(value: string): boolean {
  return EDITOR_TRANSACTION_STATUS_OPTIONS.includes(value);
}

export interface RevisionState {
  amount: number | null;
  revisions: number;
  /** The per-revision rate this transaction's revisions were charged at. */
  revisionRate: number | null;
}

/**
 * Adds (or, with a negative delta, takes back) revisions on one transaction,
 * moving its amount by the per-revision rate.
 *
 * The amount stays the total owed, so payouts, invoice margins and the
 * activity feed keep reading one number. The rate is pinned on the
 * transaction when its first revision is charged: raising an editor's rate
 * later leaves work already agreed at the old one alone, and taking a
 * revision back subtracts exactly what adding it added.
 *
 * The count never goes below zero, and the amount only moves by the
 * revisions actually applied.
 */
export function applyRevisionChange(current: RevisionState, delta: number, editorRate: number): RevisionState {
  const rate = current.revisions > 0 && current.revisionRate != null ? current.revisionRate : editorRate;
  const revisions = Math.max(0, current.revisions + Math.trunc(delta));
  const charged = (revisions - current.revisions) * rate;
  return {
    amount: current.amount == null && charged === 0 ? null : (current.amount ?? 0) + charged,
    revisions,
    revisionRate: revisions > 0 ? rate : null,
  };
}

// A count or rate typed into a form, or read from a record written before the
// field existed: anything that isn't a non-negative number becomes 0.
export function toNonNegativeInt(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

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
// two dates it's computed from. Null when either date is missing, which is
// normal for a cut that hasn't been delivered yet.
export function computeEtaDays(videoDate: string, deliveryDate: string): number | null {
  const start = parseSheetDate(videoDate);
  const end = parseSheetDate(deliveryDate);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return Math.round((end - start) / 86_400_000);
}

export interface EditorTransactionStats {
  count: number;
  /** Assigned, not yet delivered, and not cancelled. */
  inProgressCount: number;
  avgEtaDays: number;
  /** How many delivered cuts the average is taken over. */
  etaSample: number;
}

export function computeEditorTransactionStats(
  items: { deliveryDate: string; status: string; etaDays: number | null }[]
): EditorTransactionStats {
  const inProgressCount = items.filter(
    (item) =>
      Number.isNaN(parseSheetDate(item.deliveryDate)) && item.status.trim().toLowerCase() !== "cancelled"
  ).length;
  // Undelivered cuts have no turnaround yet; counting them as 0d would
  // flatter the average.
  const etas = items.flatMap((item) => (item.etaDays == null ? [] : [item.etaDays]));
  const avgEtaDays = etas.length
    ? Math.round((etas.reduce((sum, eta) => sum + eta, 0) / etas.length) * 10) / 10
    : 0;
  return { count: items.length, inProgressCount, avgEtaDays, etaSample: etas.length };
}

export interface EditorPayoutSummary {
  paid: number;
  pending: number;
}

// What has gone out to editors and what is still owed, across every job. A
// "Cancelled" transaction never happened commercially, so it counts toward
// neither figure: same convention as the earnings overview's handling of
// cancelled deals.
//
// The dashboard's only view of outgoing money. Everything else it reports is
// income, which makes "earned" read as "kept" when a share of it was always
// going to be paid on.
export function computeEditorPayouts(
  transactions: { amount: number | null; status: string }[]
): EditorPayoutSummary {
  let paid = 0;
  let pending = 0;
  for (const txn of transactions) {
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

// Sums what's actually owed to one editor. Exact-string match on the name:
// see repositories/editorTransactions.writer.server.ts, where renaming an
// editor rewrites their transactions for exactly this reason.
export function computeEditorPayoutSummary(
  editorName: string,
  transactions: { editor: string; amount: number | null; status: string }[]
): EditorPayoutSummary {
  return computeEditorPayouts(transactions.filter((txn) => txn.editor === editorName));
}

/**
 * What the editing cost, month by month.
 *
 * Bucketed on the day the cut was delivered, falling back to the day it was
 * assigned. That is an accrual, not a cash-out: a transaction records when the
 * work happened and never when the editor was actually settled, so this
 * answers "what did this month's output cost to make" and cannot answer "what
 * left the account in August". The distinction matters enough that the
 * dashboard's to-date payout tiles deliberately stay unbucketed, and the
 * margin series built on this says "net of editing" rather than "cash left".
 *
 * Pending work counts alongside paid, because the cost was incurred when the
 * cut was delivered whether or not the invoice has cleared. Cancelled never
 * happened, the same convention computeEditorPayouts applies.
 *
 * Keyed "YYYY-MM" to line up with MonthlyEarnings; transactions carrying no
 * usable date are dropped rather than filed under a month they might not
 * belong to.
 */
export function computeMonthlyEditorCost(
  transactions: { videoDate: string; deliveryDate: string; amount: number | null; status: string }[]
): Map<string, number> {
  const byMonth = new Map<string, number>();

  for (const txn of transactions) {
    if (txn.status.trim().toLowerCase() === "cancelled") continue;
    const amount = txn.amount ?? 0;
    if (amount === 0) continue;

    const month = (toIsoDate(txn.deliveryDate) || toIsoDate(txn.videoDate)).slice(0, 7);
    if (month === "") continue;

    byMonth.set(month, (byMonth.get(month) ?? 0) + amount);
  }

  return byMonth;
}
