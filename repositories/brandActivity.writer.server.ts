import "server-only";
import { getRedis } from "@/lib/cache";
import brandActivitySeed from "@/data/brand-activity.json";
import type { BrandActivity, NewBrandActivity } from "./brandActivity";

// Deliberately not re-exported from ./index (the shared repository barrel) —
// mirrors editors.writer.server.ts / editorTransactions.writer.server.ts.
const BRAND_ACTIVITY_KEY = "brand_activity";
const REDIS_NOT_CONFIGURED = "Upstash Redis not configured — set KV_REST_API_URL and KV_REST_API_TOKEN";
const SEED = brandActivitySeed as BrandActivity[];

async function readBrandActivity(): Promise<BrandActivity[]> {
  const redis = getRedis();
  if (!redis) return SEED;
  const stored = await redis.get<BrandActivity[]>(BRAND_ACTIVITY_KEY);
  return stored ?? SEED;
}

// Falls back to the bundled data/brand-activity.json seed until the first
// entry is logged, or whenever Redis isn't configured (e.g. local dev
// without KV env vars).
export async function getBrandActivity(): Promise<BrandActivity[]> {
  return readBrandActivity();
}

export async function addBrandActivity(input: NewBrandActivity): Promise<BrandActivity> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  const activity = await readBrandActivity();
  const entry: BrandActivity = {
    id: crypto.randomUUID(),
    brandId: input.brandId,
    type: input.type,
    summary: input.summary.trim(),
    createdAt: new Date().toISOString(),
  };
  await redis.set(BRAND_ACTIVITY_KEY, [...activity, entry]);
  return entry;
}

// Cascade for brand deletion.
export async function deleteBrandActivityForBrand(brandId: string): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  const activity = await readBrandActivity();
  await redis.set(
    BRAND_ACTIVITY_KEY,
    activity.filter((entry) => entry.brandId !== brandId)
  );
}
