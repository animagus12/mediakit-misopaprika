import "server-only";
import { getRedis } from "@/lib/cache";
import { PARTNER_TRANSFERS_KEY, readPartnerTransfers } from "./partnerTransferRecords.server";
import type { PartnerTransferInput, PartnerTransferRecord } from "./partnerTransfers";

// server-only, and never imported from a client component: the server actions
// import it directly. One Redis key holding the whole list, read, modify, write.

const REDIS_NOT_CONFIGURED = "Upstash Redis not configured: set KV_REST_API_URL and KV_REST_API_TOKEN";

function requireRedis() {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  return redis;
}

/**
 * Saves a settle-up. Idempotent per id: the form makes one id per opening, so
 * a double tap records the money moving once.
 */
export async function addPartnerTransfer(
  input: PartnerTransferInput
): Promise<{ record: PartnerTransferRecord; created: boolean }> {
  const redis = requireRedis();
  const records = await readPartnerTransfers();
  const existing = records.find((record) => record.id === input.id);
  if (existing) return { record: existing, created: false };
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
  await redis.set(PARTNER_TRANSFERS_KEY, [...records, record]);
  return { record, created: true };
}

/** Returns the settle-up it removed, for Trash, or null when the id matched nothing. */
export async function deletePartnerTransfer(id: string): Promise<PartnerTransferRecord | null> {
  const redis = requireRedis();
  const records = await readPartnerTransfers();
  const removed = records.find((record) => record.id === id) ?? null;
  if (!removed) return null;
  await redis.set(PARTNER_TRANSFERS_KEY, records.filter((record) => record.id !== id));
  return removed;
}

/** Puts a settle-up back from Trash; one already there is left alone. */
export async function restorePartnerTransfer(record: PartnerTransferRecord): Promise<void> {
  const redis = requireRedis();
  const records = await readPartnerTransfers();
  if (records.some((entry) => entry.id === record.id)) return;
  await redis.set(PARTNER_TRANSFERS_KEY, [...records, record]);
}
