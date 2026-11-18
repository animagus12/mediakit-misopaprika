import "server-only";
import { getRedis, readStored } from "@/lib/cache";
import affiliatePayoutsSeed from "@/data/affiliate-payouts.json";
import { toSheetDate } from "@/lib/editorTransactions";
import type { RecordChange } from "@/lib/activityDiff";
import { listOrSeed, type Mutation } from "@/lib/storeMutation";
import { mutateStored } from "@/lib/storeWrite.server";
import type {
  AffiliatePayout,
  AffiliatePayoutUpdate,
  NewAffiliatePayout,
} from "./affiliatePayouts";

// server-only, and never imported from a client component: the server actions
// and pages that need it import it directly. See
// editorTransactions.writer.server.ts for why storage lives here.
const AFFILIATE_PAYOUTS_KEY = "affiliate_payouts";
const SEED = affiliatePayoutsSeed as AffiliatePayout[];
const toPayouts = listOrSeed(SEED);

async function readPayouts(): Promise<AffiliatePayout[]> {
  const redis = getRedis();
  if (!redis) return SEED;
  return toPayouts(await readStored<unknown>(AFFILIATE_PAYOUTS_KEY));
}

// Each write is a compare-and-set over the whole list (see
// lib/storeWrite.server.ts), so two saves that overlap are both kept.
function mutatePayouts<R>(change: Mutation<AffiliatePayout[], R>): Promise<R> {
  return mutateStored(AFFILIATE_PAYOUTS_KEY, toPayouts, change);
}

// Falls back to the bundled data/affiliate-payouts.json seed until the first
// payout is added, or whenever Redis isn't configured (e.g. local dev without
// KV env vars).
export async function getAffiliatePayouts(): Promise<AffiliatePayout[]> {
  return readPayouts();
}

// A pending payout has no paid date, and one carried over from an earlier
// "received" would otherwise file the money in a month it never arrived in:
// monthKey() in repositories/earnings.ts reads paidDate first.
function shape(input: NewAffiliatePayout, id: string): AffiliatePayout {
  const received = input.paymentStatus === "received";
  return {
    id,
    partnerId: input.partnerId,
    periodStart: toSheetDate(input.periodStart),
    periodEnd: toSheetDate(input.periodEnd),
    grossSales: input.grossSales,
    salesCount: input.salesCount,
    commissionAmount: input.commissionAmount,
    paymentStatus: input.paymentStatus,
    paidDate: received && input.paidDate ? toSheetDate(input.paidDate) : "",
    paymentMethod: input.paymentMethod.trim(),
  };
}

export function addAffiliatePayout(input: NewAffiliatePayout): Promise<void> {
  const payout = shape(input, crypto.randomUUID());
  return mutatePayouts((payouts) => ({ next: [...payouts, payout], result: undefined }));
}

// Answers the record either side of the write, or null when the id matched
// nothing: see updateEditorTransaction for why the caller gets both sides
// rather than diffing against its own input.
export function updateAffiliatePayout(
  input: AffiliatePayoutUpdate
): Promise<RecordChange<AffiliatePayout> | null> {
  return mutatePayouts((payouts) => {
    const before = payouts.find((payout) => payout.id === input.id);
    if (!before) return { next: null, result: null };
    const after = shape(input, before.id);
    return {
      next: payouts.map((payout) => (payout.id === input.id ? after : payout)),
      result: { before, after },
    };
  });
}

// Returns the payout it removed, or null when the id matched nothing: see
// deleteBrand in brands.writer.server.ts for why.
export function deleteAffiliatePayout(id: string): Promise<AffiliatePayout | null> {
  return mutatePayouts((payouts) => {
    const removed = payouts.find((payout) => payout.id === id) ?? null;
    if (!removed) return { next: null, result: null };
    return { next: payouts.filter((payout) => payout.id !== id), result: removed };
  });
}

export function restoreAffiliatePayout(record: AffiliatePayout): Promise<void> {
  return mutatePayouts((payouts) => ({
    next: payouts.some((payout) => payout.id === record.id) ? null : [...payouts, record],
    result: undefined,
  }));
}
