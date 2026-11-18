import "server-only";
import type { RecordChange } from "@/lib/activityDiff";
import type { Mutation } from "@/lib/storeMutation";
import { mutateStored } from "@/lib/storeWrite.server";
import { EXPENSES_KEY, toExpenseRecords } from "./expenseRecords.server";
import type { PartnerSettlement } from "@/lib/payers";
import type { ExpenseInput, ExpenseRecord, ExpenseReimbursement } from "./expenses";

// server-only, and never imported from a client component: the server actions
// import it directly. The list lives under one Redis key as a whole array,
// like every other collection, and each write is a compare-and-set over it
// (see lib/storeWrite.server.ts), so two saves that overlap are both kept.

function mutateExpenses<R>(change: Mutation<ExpenseRecord[], R>): Promise<R> {
  return mutateStored(EXPENSES_KEY, toExpenseRecords, change);
}

function fromInput(input: ExpenseInput): Omit<ExpenseRecord, "createdAt" | "updatedAt"> {
  return {
    id: input.id,
    date: input.date,
    amount: input.amount,
    category: input.category,
    description: input.description.trim(),
    paidBy: input.paidBy,
    settlement: input.settlement,
    method: input.method,
    campaignId: input.campaignId,
    reimbursement: input.campaignId ? input.reimbursement : null,
    receiptUrl: input.receiptUrl,
    note: input.note.trim(),
  };
}

/**
 * Saves a new expense. Idempotent per id: the form makes one id per opening,
 * so a double tap or a retry after a slow network answers the copy already
 * saved instead of recording the purchase twice.
 */
export function addExpense(input: ExpenseInput): Promise<{ record: ExpenseRecord; created: boolean }> {
  return mutateExpenses<{ record: ExpenseRecord; created: boolean }>((records) => {
    const existing = records.find((record) => record.id === input.id);
    if (existing) return { next: null, result: { record: existing, created: false } };
    const now = new Date().toISOString();
    const record: ExpenseRecord = { ...fromInput(input), createdAt: now, updatedAt: now };
    return { next: [...records, record], result: { record, created: true } };
  });
}

/** Answers the record either side of the write, or null when the id matched nothing. */
export function updateExpense(input: ExpenseInput): Promise<RecordChange<ExpenseRecord> | null> {
  return replaceExpense(input.id, (before) => ({
    ...fromInput(input),
    createdAt: before.createdAt,
    updatedAt: new Date().toISOString(),
  }));
}

/** Rewrites one expense, answering it either side of the write, or null when the id matched nothing. */
function replaceExpense(
  id: string,
  rewrite: (before: ExpenseRecord) => ExpenseRecord
): Promise<RecordChange<ExpenseRecord> | null> {
  return mutateExpenses((records) => {
    const before = records.find((record) => record.id === id);
    if (!before) return { next: null, result: null };
    const after = rewrite(before);
    return { next: records.map((record) => (record.id === id ? after : record)), result: { before, after } };
  });
}

/**
 * How an expense a partner paid is settled, and nothing else: the quick
 * decision on the Payments page, which shouldn't resend the whole expense.
 */
export function setExpenseSettlement(
  id: string,
  settlement: PartnerSettlement | null
): Promise<RecordChange<ExpenseRecord> | null> {
  return replaceExpense(id, (before) => ({ ...before, settlement, updatedAt: new Date().toISOString() }));
}

/**
 * When the brand paid an expense back, and nothing else: the quick "paid back"
 * on a deal or the Payments page, which shouldn't resend the whole expense.
 */
export function setExpenseReimbursement(
  id: string,
  reimbursement: ExpenseReimbursement
): Promise<RecordChange<ExpenseRecord> | null> {
  return replaceExpense(id, (before) => ({ ...before, reimbursement, updatedAt: new Date().toISOString() }));
}

/** Returns the expense it removed, for Trash, or null when the id matched nothing. */
export function deleteExpense(id: string): Promise<ExpenseRecord | null> {
  return mutateExpenses((records) => {
    const removed = records.find((record) => record.id === id) ?? null;
    if (!removed) return { next: null, result: null };
    return { next: records.filter((record) => record.id !== id), result: removed };
  });
}

/** Puts an expense back from Trash; one already there (an Undo pressed twice) is left alone. */
export function restoreExpense(record: ExpenseRecord): Promise<void> {
  return mutateExpenses((records) =>
    records.some((entry) => entry.id === record.id)
      ? { next: null, result: undefined }
      : { next: [...records, record], result: undefined }
  );
}
