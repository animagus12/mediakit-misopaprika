import "server-only";
import type { Mutation } from "@/lib/storeMutation";
import { mutateStored } from "@/lib/storeWrite.server";
import { PARTNER_TRANSFERS_KEY, toPartnerTransfers } from "./partnerTransferRecords.server";
import type { PartnerTransferInput, PartnerTransferRecord } from "./partnerTransfers";

// server-only, and never imported from a client component: the server actions
// import it directly. One Redis key holding the whole list, each write a
// compare-and-set over it (see lib/storeWrite.server.ts).

function mutateTransfers<R>(change: Mutation<PartnerTransferRecord[], R>): Promise<R> {
  return mutateStored(PARTNER_TRANSFERS_KEY, toPartnerTransfers, change);
}

/**
 * Saves a settle-up. Idempotent per id: the form makes one id per opening, so
 * a double tap records the money moving once.
 */
export function addPartnerTransfer(
  input: PartnerTransferInput
): Promise<{ record: PartnerTransferRecord; created: boolean }> {
  return mutateTransfers<{ record: PartnerTransferRecord; created: boolean }>((records) => {
    const existing = records.find((record) => record.id === input.id);
    if (existing) return { next: null, result: { record: existing, created: false } };
    const now = new Date().toISOString();
    const record: PartnerTransferRecord = {
      id: input.id,
      date: input.date,
      from: input.from,
      to: input.to,
      amount: input.amount,
      note: input.note.trim(),
      createdAt: now,
      updatedAt: now,
    };
    return { next: [...records, record], result: { record, created: true } };
  });
}

/** Returns the settle-up it removed, for Trash, or null when the id matched nothing. */
export function deletePartnerTransfer(id: string): Promise<PartnerTransferRecord | null> {
  return mutateTransfers((records) => {
    const removed = records.find((record) => record.id === id) ?? null;
    if (!removed) return { next: null, result: null };
    return { next: records.filter((record) => record.id !== id), result: removed };
  });
}

/** Puts a settle-up back from Trash; one already there is left alone. */
export function restorePartnerTransfer(record: PartnerTransferRecord): Promise<void> {
  return mutateTransfers((records) =>
    records.some((entry) => entry.id === record.id)
      ? { next: null, result: undefined }
      : { next: [...records, record], result: undefined }
  );
}
