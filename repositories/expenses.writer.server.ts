import "server-only";
import type { RecordChange } from "@/lib/activityDiff";
import { getRedis } from "@/lib/cache";
import { EXPENSES_KEY, readExpenseRecords } from "./expenseRecords.server";
import type { ExpenseInput, ExpenseRecord } from "./expenses";

// server-only, and never imported from a client component: the server actions
// import it directly. The list lives under one Redis key as a whole array,
// like every other collection, and each write is read, modify, write.

const REDIS_NOT_CONFIGURED = "Upstash Redis not configured: set KV_REST_API_URL and KV_REST_API_TOKEN";

function requireRedis() {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  return redis;
}

function fromInput(input: ExpenseInput): Omit<ExpenseRecord, "createdAt" | "updatedAt"> {
  return {
    id: input.id,
    date: input.date,
    amount: input.amount,
    category: input.category,
    description: input.description.trim(),
    paidBy: input.paidBy,
    method: input.method,
    campaignId: input.campaignId,
    receiptUrl: input.receiptUrl,
    note: input.note.trim(),
  };
}

/**
 * Saves a new expense. Idempotent per id: the form makes one id per opening,
 * so a double tap or a retry after a slow network answers the copy already
 * saved instead of recording the purchase twice.
 */
export async function addExpense(input: ExpenseInput): Promise<{ record: ExpenseRecord; created: boolean }> {
  const redis = requireRedis();
  const records = await readExpenseRecords();
  const existing = records.find((record) => record.id === input.id);
  if (existing) return { record: existing, created: false };
  const now = new Date().toISOString();
  const record: ExpenseRecord = { ...fromInput(input), createdAt: now, updatedAt: now };
  await redis.set(EXPENSES_KEY, [...records, record]);
  return { record, created: true };
}

/** Answers the record either side of the write, or null when the id matched nothing. */
export async function updateExpense(input: ExpenseInput): Promise<RecordChange<ExpenseRecord> | null> {
  const redis = requireRedis();
  const records = await readExpenseRecords();
  const before = records.find((record) => record.id === input.id);
  if (!before) return null;
  const after: ExpenseRecord = { ...fromInput(input), createdAt: before.createdAt, updatedAt: new Date().toISOString() };
  await redis.set(EXPENSES_KEY, records.map((record) => (record.id === input.id ? after : record)));
  return { before, after };
}

/** Returns the expense it removed, for Trash, or null when the id matched nothing. */
export async function deleteExpense(id: string): Promise<ExpenseRecord | null> {
  const redis = requireRedis();
  const records = await readExpenseRecords();
  const removed = records.find((record) => record.id === id) ?? null;
  if (!removed) return null;
  await redis.set(EXPENSES_KEY, records.filter((record) => record.id !== id));
  return removed;
}

/** Puts an expense back from Trash; one already there (an Undo pressed twice) is left alone. */
export async function restoreExpense(record: ExpenseRecord): Promise<void> {
  const redis = requireRedis();
  const records = await readExpenseRecords();
  if (records.some((entry) => entry.id === record.id)) return;
  await redis.set(EXPENSES_KEY, [...records, record]);
}
