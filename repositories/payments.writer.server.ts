import "server-only";
import type { RecordChange } from "@/lib/activityDiff";
import { mutateStored } from "@/lib/storeWrite.server";
import { PAYMENTS_KEY, toPaymentRecords } from "./paymentRecords.server";
import { createPaymentWriter, type InsertPaymentsOptions, type PaymentStore } from "./paymentMutations";
import type { PaymentRecord, PaymentTarget } from "./payments";

// server-only, and never imported from a client component. The ledger's
// stored list lives under one Redis key as a whole array, like every other
// collection; the rules for changing it live in ./paymentMutations, and this
// binds them to Redis. Every change is a compare-and-set (see
// lib/storeWrite.server.ts), so two saves that overlap are both kept.
//
// Imports ./paymentRecords.server only, never another writer, so the
// campaigns and invoices writers can read the ledger without a cycle.

const redisStore: PaymentStore = {
  mutate: (change) => mutateStored(PAYMENTS_KEY, toPaymentRecords, change),
};

const writer = createPaymentWriter(redisStore);

/** Idempotent per id: answers what is stored for each record, new or already saved. */
export function insertPayments(records: PaymentRecord[], options?: InsertPaymentsOptions): Promise<PaymentRecord[]> {
  return writer.insertPayments(records, options);
}

export function replacePayment(record: PaymentRecord): Promise<RecordChange<PaymentRecord> | null> {
  return writer.replacePayment(record);
}

export function removePayment(id: string): Promise<PaymentRecord | null> {
  return writer.removePayment(id);
}

export function removePaymentsWhere(match: (record: PaymentRecord) => boolean): Promise<PaymentRecord[]> {
  return writer.removePaymentsWhere(match);
}

/** Adds back the records whose ids are missing; never overwrites one that is there. */
export function restorePayments(records: PaymentRecord[]): Promise<PaymentRecord[]> {
  return writer.restorePayments(records);
}

export function retargetPayments(from: PaymentTarget, to: PaymentTarget): Promise<PaymentRecord[]> {
  return writer.retargetPayments(from, to);
}
