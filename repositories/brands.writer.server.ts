import "server-only";
import { getRedis, readStored } from "@/lib/cache";
import brandsSeed from "@/data/brands.json";
import type { RecordChange } from "@/lib/activityDiff";
import { normalizeBrandName } from "@/lib/brandCampaignStats";
import { listOrSeed, type Mutation } from "@/lib/storeMutation";
import { mutateStored } from "@/lib/storeWrite.server";
import type { Brand, BrandUpdate, NewBrand } from "./brands";

// server-only, and never imported from a client component: the server
// actions and pages that need it import it directly.
const BRANDS_KEY = "brands";
const SEED = brandsSeed as Brand[];
const toBrands = listOrSeed(SEED);

async function readBrands(): Promise<Brand[]> {
  const redis = getRedis();
  if (!redis) return SEED;
  return toBrands(await readStored<unknown>(BRANDS_KEY));
}

// Each write is a compare-and-set over the whole list (see
// lib/storeWrite.server.ts), so two saves that overlap are both kept and the
// name check below sees a brand saved a moment earlier.
function mutateBrands<R>(change: Mutation<Brand[], R>): Promise<R> {
  return mutateStored(BRANDS_KEY, toBrands, change);
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
  const key = normalizeBrandName(name);
  const clash = brands.some((brand) => brand.id !== excludeId && normalizeBrandName(brand.name) === key);
  if (clash) throw new Error(`"${name}" is already in the brands list`);
}

export function addBrand(input: NewBrand): Promise<Brand> {
  const name = input.name.trim();
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
  return mutateBrands((brands) => {
    assertNameAvailable(brands, name);
    return { next: [...brands, brand], result: brand };
  });
}

// Answers the record either side of the write, or null when the id matched
// nothing, so the caller can say what actually changed without re-reading the
// list this already holds. Comparing against the caller's input instead would
// be wrong: the normalising below means a trailing space would read as an edit.
export function updateBrand(input: BrandUpdate): Promise<RecordChange<Brand> | null> {
  const name = input.name.trim();
  return mutateBrands((brands) => {
    assertNameAvailable(brands, name, input.id);
    const before = brands.find((brand) => brand.id === input.id);
    if (!before) return { next: null, result: null };
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
    return { next: brands.map((brand) => (brand.id === input.id ? after : brand)), result: { before, after } };
  });
}

// Sets just the logo, leaving every other field untouched: for assigning
// an already-uploaded media kit logo to a brand (see lib/brands.ts's
// brandsWithoutLogo / app/brands/actions.ts's assignBrandLogo) without
// requiring the full brand form.
// Returns the brand it touched, or null when the id matched nothing, so the
// caller can name it without a second read.
export function setBrandLogo(id: string, logoUrl: string): Promise<Brand | null> {
  return mutateBrands((brands) => {
    const before = brands.find((brand) => brand.id === id);
    if (!before) return { next: null, result: null };
    const after: Brand = { ...before, logoUrl, updatedAt: new Date().toISOString() };
    return { next: brands.map((brand) => (brand.id === id ? after : brand)), result: after };
  });
}

// Returns the brand it removed, or null when the id matched nothing. The
// caller needs the name for the activity log, and reading it back after the
// write is impossible by definition.
export function deleteBrand(id: string): Promise<Brand | null> {
  return mutateBrands((brands) => {
    const removed = brands.find((brand) => brand.id === id) ?? null;
    if (!removed) return { next: null, result: null };
    return { next: brands.filter((brand) => brand.id !== id), result: removed };
  });
}

export function restoreBrand(record: Brand): Promise<void> {
  return mutateBrands((brands) => {
    if (brands.some((brand) => brand.id === record.id)) return { next: null, result: undefined };
    assertNameAvailable(brands, record.name);
    return { next: [...brands, record], result: undefined };
  });
}
