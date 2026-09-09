import "server-only";
import { getRedis } from "@/lib/cache";
import affiliatePayoutsSeed from "@/data/affiliate-payouts.json";
import { toSheetDate } from "@/lib/editorTransactions";
import type { RecordChange } from "@/lib/activityDiff";
import type {
  AffiliatePayout,
  AffiliatePayoutUpdate,
  NewAffiliatePayout,
} from "./affiliatePayouts";

// server-only, and never imported from a client component: the server actions
// and pages that need it import it directly. See
// editorTransactions.writer.server.ts for why storage lives here.
const AFFILIATE_PAYOUTS_KEY = "affiliate_payouts";
const REDIS_NOT_CONFIGURED = "Upstash Redis not configured: set KV_REST_API_URL and KV_REST_API_TOKEN";
const SEED = affiliatePayoutsSeed as AffiliatePayout[];

async function readPayouts(): Promise<AffiliatePayout[]> {
  const redis = getRedis();
  if (!redis) return SEED;
  const stored = await redis.get<AffiliatePayout[]>(AFFILIATE_PAYOUTS_KEY);
  return stored ?? SEED;
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

export async function addAffiliatePayout(input: NewAffiliatePayout): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  const payouts = await readPayouts();
  await redis.set(AFFILIATE_PAYOUTS_KEY, [...payouts, shape(input, crypto.randomUUID())]);
}

// Answers the record either side of the write, or null when the id matched
// nothing: see updateEditorTransaction for why the caller gets both sides
// rather than diffing against its own input.
export async function updateAffiliatePayout(
  input: AffiliatePayoutUpdate
): Promise<RecordChange<AffiliatePayout> | null> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  const payouts = await readPayouts();
  const before = payouts.find((payout) => payout.id === input.id);
  if (!before) return null;
  const after = shape(input, before.id);
  await redis.set(
    AFFILIATE_PAYOUTS_KEY,
    payouts.map((payout) => (payout.id === input.id ? after : payout))
  );
  return { before, after };
}

// Returns the payout it removed, or null when the id matched nothing: see
// deleteBrand in brands.writer.server.ts for why.
export async function deleteAffiliatePayout(id: string): Promise<AffiliatePayout | null> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  const payouts = await readPayouts();
  const removed = payouts.find((payout) => payout.id === id) ?? null;
  await redis.set(
    AFFILIATE_PAYOUTS_KEY,
    payouts.filter((payout) => payout.id !== id)
  );
  return removed;
}
