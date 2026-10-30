import "server-only";
import { getRedis } from "@/lib/cache";
import expensesSeed from "@/data/expenses.json";
import { EXPENSES_SEED_KEY, toExpenseRecord, type ExpenseRecord } from "./expenses";

// The expenses as stored, with nothing joined onto them. Its own module, like
// ./paymentRecords.server, so the campaign read can join a deal's costs
// without importing the code that writes them.
export const EXPENSES_KEY = EXPENSES_SEED_KEY;
const SEED: unknown[] = expensesSeed;

/**
 * Every stored expense, coerced on read; a row that cannot be one is dropped.
 *
 * Strict: a failed read throws rather than reading as no expenses, which
 * would quietly overstate every margin. Falls back to the bundled
 * data/expenses.json (empty) until the first expense is saved, or when Redis
 * isn't configured.
 */
export async function readExpenseRecords(): Promise<ExpenseRecord[]> {
  const redis = getRedis();
  const stored = redis ? await redis.get<unknown[]>(EXPENSES_KEY) : null;
  const raw = Array.isArray(stored) ? stored : SEED;
  const records: ExpenseRecord[] = [];
  for (const value of raw) {
    const record = toExpenseRecord(value);
    if (record) records.push(record);
  }
  return records;
}
