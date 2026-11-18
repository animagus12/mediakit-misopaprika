import "server-only";
import { getRedis, readStored } from "@/lib/cache";
import brandNotesSeed from "@/data/brand-notes.json";
import { listOrSeed, type Mutation } from "@/lib/storeMutation";
import { mutateStored } from "@/lib/storeWrite.server";
import type { BrandNote, NewBrandNote } from "./brandNotes";

// server-only, and never imported from a client component: the server
// actions and pages that need it import it directly.
const BRAND_NOTES_KEY = "brand_notes";
const SEED = brandNotesSeed as BrandNote[];
const toBrandNotes = listOrSeed(SEED);

async function readBrandNotes(): Promise<BrandNote[]> {
  const redis = getRedis();
  if (!redis) return SEED;
  return toBrandNotes(await readStored<unknown>(BRAND_NOTES_KEY));
}

// Each write is a compare-and-set over the whole list (see
// lib/storeWrite.server.ts), so two saves that overlap are both kept.
function mutateBrandNotes<R>(change: Mutation<BrandNote[], R>): Promise<R> {
  return mutateStored(BRAND_NOTES_KEY, toBrandNotes, change);
}

// Falls back to the bundled data/brand-notes.json seed until the first note
// is added, or whenever Redis isn't configured (e.g. local dev without KV
// env vars).
export async function getBrandNotes(): Promise<BrandNote[]> {
  return readBrandNotes();
}

export function addBrandNote(input: NewBrandNote): Promise<BrandNote> {
  const note: BrandNote = {
    id: crypto.randomUUID(),
    brandId: input.brandId,
    body: input.body.trim(),
    createdAt: new Date().toISOString(),
  };
  return mutateBrandNotes((notes) => ({ next: [...notes, note], result: note }));
}

export function deleteBrandNote(id: string): Promise<void> {
  return removeNotesWhere((note) => note.id === id);
}

export async function restoreBrandNotes(records: BrandNote[]): Promise<void> {
  if (records.length === 0) return;
  await mutateBrandNotes((notes) => {
    const existing = new Set(notes.map((note) => note.id));
    const missing = records.filter((record) => !existing.has(record.id));
    return { next: missing.length > 0 ? [...notes, ...missing] : null, result: undefined };
  });
}

// Cascade for brand deletion.
export function deleteBrandNotesForBrand(brandId: string): Promise<void> {
  return removeNotesWhere((note) => note.brandId === brandId);
}

function removeNotesWhere(match: (note: BrandNote) => boolean): Promise<void> {
  return mutateBrandNotes((notes) => ({
    next: notes.some(match) ? notes.filter((note) => !match(note)) : null,
    result: undefined,
  }));
}
