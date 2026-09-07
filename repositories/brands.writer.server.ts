import "server-only";
import { getRedis } from "@/lib/cache";
import brandsSeed from "@/data/brands.json";
import type { RecordChange } from "@/lib/activityDiff";
import type { Brand, BrandUpdate, NewBrand } from "./brands";

// server-only, and never imported from a client component: the server
// actions and pages that need it import it directly.
const BRANDS_KEY = "brands";
const REDIS_NOT_CONFIGURED = "Upstash Redis not configured: set KV_REST_API_URL and KV_REST_API_TOKEN";
const SEED = brandsSeed as Brand[];

async function readBrands(): Promise<Brand[]> {
  const redis = getRedis();
  if (!redis) return SEED;
  const stored = await redis.get<Brand[]>(BRANDS_KEY);
  return stored ?? SEED;
}

// Falls back to the bundled data/brands.json seed until the first brand is
// added, or whenever Redis isn't configured (e.g. local dev without KV env
// vars).
export async function getBrands(): Promise<Brand[]> {
  return readBrands();
}

export async function getBrand(id: string): Promise<Brand | null> {
  const brands = await readBrands();
  return brands.find((brand) => brand.id === id) ?? null;
}

// Name is the key used to match a brand against the Campaigns sheet's Brand
// column (see lib/brandCampaignStats.ts), so two CRM entries with the same
// name would silently split one brand's campaign history in two.
function assertNameAvailable(brands: Brand[], name: string, excludeId?: string): void {
  const clash = brands.some(
    (brand) => brand.id !== excludeId && brand.name.trim().toLowerCase() === name.toLowerCase()
  );
  if (clash) throw new Error(`"${name}" is already in the brands list`);
}

export async function addBrand(input: NewBrand): Promise<Brand> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  const brands = await readBrands();
  const name = input.name.trim();
  assertNameAvailable(brands, name);
  const now = new Date().toISOString();
  const brand: Brand = {
    id: crypto.randomUUID(),
    name,
    logoUrl: input.logoUrl,
    website: input.website.trim(),
    instagram: input.instagram.trim(),
    agencyId: input.agencyId,
    primaryContactId: input.primaryContactId,
    status: input.status,
    createdAt: now,
    updatedAt: now,
  };
  await redis.set(BRANDS_KEY, [...brands, brand]);
  return brand;
}

// Answers the record either side of the write, or null when the id matched
// nothing, so the caller can say what actually changed without re-reading the
// list this already holds. Comparing against the caller's input instead would
// be wrong: the normalising below means a trailing space would read as an edit.
export async function updateBrand(input: BrandUpdate): Promise<RecordChange<Brand> | null> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  const brands = await readBrands();
  const name = input.name.trim();
  assertNameAvailable(brands, name, input.id);
  const before = brands.find((brand) => brand.id === input.id);
  if (!before) return null;
  const after: Brand = {
    ...before,
    name,
    logoUrl: input.logoUrl,
    website: input.website.trim(),
    instagram: input.instagram.trim(),
    agencyId: input.agencyId,
    primaryContactId: input.primaryContactId,
    status: input.status,
    updatedAt: new Date().toISOString(),
  };
  await redis.set(BRANDS_KEY, brands.map((brand) => (brand.id === input.id ? after : brand)));
  return { before, after };
}

// Sets just the logo, leaving every other field untouched: for assigning
// an already-uploaded media kit logo to a brand (see lib/brands.ts's
// brandsWithoutLogo / app/brands/actions.ts's assignBrandLogo) without
// requiring the full brand form.
// Returns the brand it touched, or null when the id matched nothing, so the
// caller can name it without a second read.
export async function setBrandLogo(id: string, logoUrl: string): Promise<Brand | null> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  const brands = await readBrands();
  const updated = brands.map((brand): Brand =>
    brand.id === id ? { ...brand, logoUrl, updatedAt: new Date().toISOString() } : brand
  );
  await redis.set(BRANDS_KEY, updated);
  return updated.find((brand) => brand.id === id) ?? null;
}

// Returns the brand it removed, or null when the id matched nothing. The
// caller needs the name for the activity log, and reading it back after the
// write is impossible by definition.
export async function deleteBrand(id: string): Promise<Brand | null> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  const brands = await readBrands();
  const removed = brands.find((brand) => brand.id === id) ?? null;
  await redis.set(
    BRANDS_KEY,
    brands.filter((brand) => brand.id !== id)
  );
  return removed;
}
