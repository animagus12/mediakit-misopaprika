import "server-only";
import { getRedis, readStored } from "@/lib/cache";
import affiliatePartnersSeed from "@/data/affiliate-partners.json";
import { toSheetDate } from "@/lib/editorTransactions";
import type { RecordChange } from "@/lib/activityDiff";
import { listOrSeed, type Mutation } from "@/lib/storeMutation";
import { mutateStored } from "@/lib/storeWrite.server";
import type {
  AffiliatePartner,
  AffiliatePartnerUpdate,
  NewAffiliatePartner,
} from "./affiliatePartners";

// server-only, and never imported from a client component: the server actions
// and pages that need it import it directly. Same shape as
// editors.writer.server.ts, including why the storage logic lives here rather
// than in ./affiliatePartners: Vercel's serverless filesystem is read-only,
// so writes go to Redis.
const AFFILIATE_PARTNERS_KEY = "affiliate_partners";
const SEED = affiliatePartnersSeed as AffiliatePartner[];
const toPartners = listOrSeed(SEED);

async function readPartners(): Promise<AffiliatePartner[]> {
  const redis = getRedis();
  if (!redis) return SEED;
  return toPartners(await readStored<unknown>(AFFILIATE_PARTNERS_KEY));
}

// Each write is a compare-and-set over the whole list (see
// lib/storeWrite.server.ts), so two saves that overlap are both kept and the
// code check below sees a partner saved a moment earlier.
function mutatePartners<R>(change: Mutation<AffiliatePartner[], R>): Promise<R> {
  return mutateStored(AFFILIATE_PARTNERS_KEY, toPartners, change);
}

// Falls back to the bundled data/affiliate-partners.json seed until the first
// partner is added, or whenever Redis isn't configured (e.g. local dev
// without KV env vars).
export async function getAffiliatePartners(): Promise<AffiliatePartner[]> {
  return readPartners();
}

// Codes are the thing a viewer types at checkout, so two programs sharing one
// would make a payout impossible to file correctly. Compared case-insensitively
// because brands print them in caps and enter them however they like.
function assertCodeAvailable(partners: AffiliatePartner[], code: string, excludeId?: string): void {
  const clash = partners.some(
    (partner) => partner.id !== excludeId && partner.code.trim().toLowerCase() === code.toLowerCase()
  );
  if (clash) throw new Error(`Code "${code}" is already used by another partner`);
}

// Shared by both writes so a partner is normalised exactly once: trimming in
// two places is how the two paths drift apart.
function shape(input: NewAffiliatePartner, id: string): AffiliatePartner {
  return {
    id,
    brandId: input.brandId,
    name: input.name.trim(),
    code: input.code.trim(),
    trackingUrl: input.trackingUrl.trim(),
    commissionModel: input.commissionModel,
    commissionRate: input.commissionRate,
    status: input.status,
    startDate: toSheetDate(input.startDate),
    dashboardUrl: input.dashboardUrl.trim(),
    payoutSchedule: input.payoutSchedule,
    linkItemId: input.linkItemId,
  };
}

export function addAffiliatePartner(input: NewAffiliatePartner): Promise<void> {
  const partner = shape(input, crypto.randomUUID());
  return mutatePartners((partners) => {
    assertCodeAvailable(partners, partner.code);
    return { next: [...partners, partner], result: undefined };
  });
}

// Answers the record either side of the write, or null when the id matched
// nothing, so the caller can say what actually changed without re-reading the
// list this already holds. Comparing against the caller's input instead would
// be wrong: the normalising above means a trailing space would read as an edit.
export function updateAffiliatePartner(
  input: AffiliatePartnerUpdate
): Promise<RecordChange<AffiliatePartner> | null> {
  return mutatePartners((partners) => {
    assertCodeAvailable(partners, input.code.trim(), input.id);
    const before = partners.find((partner) => partner.id === input.id);
    if (!before) return { next: null, result: null };
    const after = shape(input, before.id);
    return {
      next: partners.map((partner) => (partner.id === input.id ? after : partner)),
      result: { before, after },
    };
  });
}
