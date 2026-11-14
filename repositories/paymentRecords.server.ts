import "server-only";
import { getRedis, readStored } from "@/lib/cache";
import paymentsSeed from "@/data/payments.json";
import { toPaymentRecord, type PaymentRecord } from "./payments";

// The payments as stored, with nothing joined onto them. Its own module, like
// ./invoiceRecords.server, so the campaign read can join the ledger without
// importing ./payments.writer.server, and so nothing that reads payments
// pulls in the code that writes them.
export const PAYMENTS_KEY = "payments";
const SEED: unknown[] = paymentsSeed;

/**
 * Every stored payment, coerced on read; a row that cannot be one is dropped.
 *
 * Strict: a failed read throws rather than reading as an empty ledger. Every
 * partly paid deal would otherwise read as pending and the money figures
 * would fall without a word. Falls back to the bundled data/payments.json
 * (empty) until the first payment is saved, or when Redis isn't configured.
 */
export async function readPaymentRecords(): Promise<PaymentRecord[]> {
  const redis = getRedis();
  return toPaymentRecords(redis ? await readStored<unknown>(PAYMENTS_KEY) : null);
}

/** What is stored under PAYMENTS_KEY (null: not set) as the records the read answers; the writer decodes with it too. */
export function toPaymentRecords(stored: unknown): PaymentRecord[] {
  const raw = Array.isArray(stored) ? stored : SEED;
  const records: PaymentRecord[] = [];
  for (const value of raw) {
    const record = toPaymentRecord(value);
    if (record) records.push(record);
  }
  return records;
}
