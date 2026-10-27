import "server-only";
import { getRedis } from "@/lib/cache";
import partnerTransfersSeed from "@/data/partner-transfers.json";
import { PARTNER_TRANSFERS_SEED_KEY, toPartnerTransferRecord, type PartnerTransferRecord } from "./partnerTransfers";

// The settle-ups as stored. Its own module, like ./expenseRecords.server, so
// a read never pulls in the code that writes them.
export const PARTNER_TRANSFERS_KEY = PARTNER_TRANSFERS_SEED_KEY;
const SEED: unknown[] = partnerTransfersSeed;

/**
 * Every settle-up, coerced on read; a row that cannot be one is dropped.
 *
 * Strict: a failed read throws rather than reading as none, which would show
 * every balance as unpaid. Falls back to the bundled (empty) seed until the
 * first settle-up, or when Redis isn't configured.
 */
export async function readPartnerTransfers(): Promise<PartnerTransferRecord[]> {
  const redis = getRedis();
  const stored = redis ? await redis.get<unknown[]>(PARTNER_TRANSFERS_KEY) : null;
  const raw = Array.isArray(stored) ? stored : SEED;
  const records: PartnerTransferRecord[] = [];
  for (const value of raw) {
    const record = toPartnerTransferRecord(value);
    if (record) records.push(record);
  }
  return records;
}
