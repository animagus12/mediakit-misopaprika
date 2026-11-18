import "server-only";
import { getRedis, readStored } from "@/lib/cache";
import agenciesSeed from "@/data/agencies.json";
import type { RecordChange } from "@/lib/activityDiff";
import { listOrSeed, type Mutation } from "@/lib/storeMutation";
import { mutateStored } from "@/lib/storeWrite.server";
import type { Agency, AgencyUpdate, NewAgency } from "./agencies";

// server-only, and never imported from a client component: the server
// actions and pages that need it import it directly.
const AGENCIES_KEY = "agencies";
const SEED = agenciesSeed as Agency[];
const toAgencies = listOrSeed(SEED);

async function readAgencies(): Promise<Agency[]> {
  const redis = getRedis();
  if (!redis) return SEED;
  return toAgencies(await readStored<unknown>(AGENCIES_KEY));
}

// Each write is a compare-and-set over the whole list (see
// lib/storeWrite.server.ts), so two saves that overlap are both kept and the
// name check below sees an agency saved a moment earlier.
function mutateAgencies<R>(change: Mutation<Agency[], R>): Promise<R> {
  return mutateStored(AGENCIES_KEY, toAgencies, change);
}

// Falls back to the bundled data/agencies.json seed until the first agency
// is added, or whenever Redis isn't configured (e.g. local dev without KV
// env vars).
export async function getAgencies(): Promise<Agency[]> {
  return readAgencies();
}

function assertNameAvailable(agencies: Agency[], name: string, excludeId?: string): void {
  const clash = agencies.some(
    (agency) => agency.id !== excludeId && agency.name.trim().toLowerCase() === name.toLowerCase()
  );
  if (clash) throw new Error(`"${name}" is already in the agencies list`);
}

export function addAgency(input: NewAgency): Promise<Agency> {
  const name = input.name.trim();
  const now = new Date().toISOString();
  const agency: Agency = {
    id: crypto.randomUUID(),
    name,
    createdAt: now,
    updatedAt: now,
  };
  return mutateAgencies((agencies) => {
    assertNameAvailable(agencies, name);
    return { next: [...agencies, agency], result: agency };
  });
}

// Answers the record either side of the write, or null when the id matched
// nothing, so the caller can say what actually changed without re-reading the
// list this already holds. Comparing against the caller's input instead would
// be wrong: the normalising below means a trailing space would read as an edit.
export function updateAgency(input: AgencyUpdate): Promise<RecordChange<Agency> | null> {
  const name = input.name.trim();
  return mutateAgencies((agencies) => {
    assertNameAvailable(agencies, name, input.id);
    const before = agencies.find((agency) => agency.id === input.id);
    if (!before) return { next: null, result: null };
    const after: Agency = { ...before, name, updatedAt: new Date().toISOString() };
    return {
      next: agencies.map((agency) => (agency.id === input.id ? after : agency)),
      result: { before, after },
    };
  });
}
