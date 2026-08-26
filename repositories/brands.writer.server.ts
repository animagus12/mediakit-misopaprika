import "server-only";
import { getRedis } from "@/lib/cache";
import brandsSeed from "@/data/brands.json";
import type { Brand, BrandUpdate, NewBrand } from "./brands";

// Deliberately not re-exported from ./index (the shared repository barrel) —
// mirrors editors.writer.server.ts / editorTransactions.writer.server.ts.
const BRANDS_KEY = "brands";
const REDIS_NOT_CONFIGURED = "Upstash Redis not configured — set KV_REST_API_URL and KV_REST_API_TOKEN";
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
    status: input.status,
    createdAt: now,
    updatedAt: now,
  };
  await redis.set(BRANDS_KEY, [...brands, brand]);
  return brand;
}

export async function updateBrand(input: BrandUpdate): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  const brands = await readBrands();
  const name = input.name.trim();
  assertNameAvailable(brands, name, input.id);
  const updated = brands.map((brand): Brand =>
    brand.id === input.id
      ? {
          ...brand,
          name,
          logoUrl: input.logoUrl,
          website: input.website.trim(),
          instagram: input.instagram.trim(),
          agencyId: input.agencyId,
          status: input.status,
          updatedAt: new Date().toISOString(),
        }
      : brand
  );
  await redis.set(BRANDS_KEY, updated);
}

// Sets just the logo, leaving every other field untouched — for assigning
// an already-uploaded media kit logo to a brand (see lib/brands.ts's
// brandsWithoutLogo / app/brands/actions.ts's assignBrandLogo) without
// requiring the full brand form.
export async function setBrandLogo(id: string, logoUrl: string): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  const brands = await readBrands();
  const updated = brands.map((brand): Brand =>
    brand.id === id ? { ...brand, logoUrl, updatedAt: new Date().toISOString() } : brand
  );
  await redis.set(BRANDS_KEY, updated);
}

export async function deleteBrand(id: string): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  const brands = await readBrands();
  await redis.set(
    BRANDS_KEY,
    brands.filter((brand) => brand.id !== id)
  );
}
