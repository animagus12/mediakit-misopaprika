import "server-only";
import { getRedis } from "@/lib/cache";
import agenciesSeed from "@/data/agencies.json";
import type { Agency, AgencyUpdate, NewAgency } from "./agencies";

// server-only, and never imported from a client component: the server
// actions and pages that need it import it directly.
const AGENCIES_KEY = "agencies";
const REDIS_NOT_CONFIGURED = "Upstash Redis not configured: set KV_REST_API_URL and KV_REST_API_TOKEN";
const SEED = agenciesSeed as Agency[];

async function readAgencies(): Promise<Agency[]> {
  const redis = getRedis();
  if (!redis) return SEED;
  const stored = await redis.get<Agency[]>(AGENCIES_KEY);
  return stored ?? SEED;
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

export async function addAgency(input: NewAgency): Promise<Agency> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  const agencies = await readAgencies();
  const name = input.name.trim();
  assertNameAvailable(agencies, name);
  const now = new Date().toISOString();
  const agency: Agency = {
    id: crypto.randomUUID(),
    name,
    createdAt: now,
    updatedAt: now,
  };
  await redis.set(AGENCIES_KEY, [...agencies, agency]);
  return agency;
}

export async function updateAgency(input: AgencyUpdate): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  const agencies = await readAgencies();
  const name = input.name.trim();
  assertNameAvailable(agencies, name, input.id);
  const updated = agencies.map((agency): Agency =>
    agency.id === input.id
      ? {
          ...agency,
          name,
          updatedAt: new Date().toISOString(),
        }
      : agency
  );
  await redis.set(AGENCIES_KEY, updated);
}
