import "server-only";
import { getRedis } from "@/lib/cache";
import brandNotesSeed from "@/data/brand-notes.json";
import type { BrandNote, NewBrandNote } from "./brandNotes";

// server-only, and never imported from a client component: the server
// actions and pages that need it import it directly.
const BRAND_NOTES_KEY = "brand_notes";
const REDIS_NOT_CONFIGURED = "Upstash Redis not configured: set KV_REST_API_URL and KV_REST_API_TOKEN";
const SEED = brandNotesSeed as BrandNote[];

async function readBrandNotes(): Promise<BrandNote[]> {
  const redis = getRedis();
  if (!redis) return SEED;
  const stored = await redis.get<BrandNote[]>(BRAND_NOTES_KEY);
  return stored ?? SEED;
}

// Falls back to the bundled data/brand-notes.json seed until the first note
// is added, or whenever Redis isn't configured (e.g. local dev without KV
// env vars).
export async function getBrandNotes(): Promise<BrandNote[]> {
  return readBrandNotes();
}

export async function addBrandNote(input: NewBrandNote): Promise<BrandNote> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  const notes = await readBrandNotes();
  const note: BrandNote = {
    id: crypto.randomUUID(),
    brandId: input.brandId,
    body: input.body.trim(),
    createdAt: new Date().toISOString(),
  };
  await redis.set(BRAND_NOTES_KEY, [...notes, note]);
  return note;
}

export async function deleteBrandNote(id: string): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  const notes = await readBrandNotes();
  await redis.set(
    BRAND_NOTES_KEY,
    notes.filter((note) => note.id !== id)
  );
}

// Cascade for brand deletion.
export async function deleteBrandNotesForBrand(brandId: string): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  const notes = await readBrandNotes();
  await redis.set(
    BRAND_NOTES_KEY,
    notes.filter((note) => note.brandId !== brandId)
  );
}
