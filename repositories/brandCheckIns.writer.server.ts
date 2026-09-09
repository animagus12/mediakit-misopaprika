import "server-only";
import { getRedis } from "@/lib/cache";
import checkInsSeed from "@/data/brand-check-ins.json";
import type { CheckIn, CheckInUpdate, NewCheckIn } from "./brandCheckIns";

// server-only, and never imported from a client component: the server
// actions and pages that need it import it directly.
const CHECK_INS_KEY = "brand_check_ins";
const REDIS_NOT_CONFIGURED = "Upstash Redis not configured: set KV_REST_API_URL and KV_REST_API_TOKEN";
const SEED = checkInsSeed as CheckIn[];

async function readCheckIns(): Promise<CheckIn[]> {
  const redis = getRedis();
  if (!redis) return SEED;
  const stored = await redis.get<CheckIn[]>(CHECK_INS_KEY);
  return stored ?? SEED;
}

// Falls back to the bundled data/brand-check-ins.json seed until the first
// check-in is logged, or whenever Redis isn't configured (e.g. local dev
// without KV env vars).
export async function getCheckIns(): Promise<CheckIn[]> {
  return readCheckIns();
}

export async function addCheckIn(input: NewCheckIn): Promise<CheckIn> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  const checkIns = await readCheckIns();
  const checkIn: CheckIn = {
    id: crypto.randomUUID(),
    subjectKind: input.subjectKind,
    subjectId: input.subjectId,
    date: input.date,
    channel: input.channel,
    // Always false on creation: a check-in is the message going out, and the
    // reply, if it comes, arrives later as an edit.
    replied: false,
    respondBy: input.respondBy,
    note: input.note.trim(),
    createdAt: new Date().toISOString(),
  };
  await redis.set(CHECK_INS_KEY, [...checkIns, checkIn]);
  return checkIn;
}

// Returns the updated record, or null when the id matched nothing, so the
// caller can name the subject without a second read.
export async function updateCheckIn(input: CheckInUpdate): Promise<CheckIn | null> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  const checkIns = await readCheckIns();
  const updated = checkIns.map((checkIn): CheckIn =>
    checkIn.id === input.id
      ? { ...checkIn, replied: input.replied, respondBy: input.respondBy }
      : checkIn
  );
  await redis.set(CHECK_INS_KEY, updated);
  return updated.find((checkIn) => checkIn.id === input.id) ?? null;
}

export async function deleteCheckIn(id: string): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  const checkIns = await readCheckIns();
  await redis.set(
    CHECK_INS_KEY,
    checkIns.filter((checkIn) => checkIn.id !== id)
  );
}

// Cascade for brand and agency deletion. Takes the kind as well as the id
// because the two id spaces are independent: a brand and an agency could in
// principle carry the same uuid, and deleting one must not empty the other.
export async function deleteCheckInsForSubject(
  subjectKind: CheckIn["subjectKind"],
  subjectId: string
): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  const checkIns = await readCheckIns();
  await redis.set(
    CHECK_INS_KEY,
    checkIns.filter(
      (checkIn) => !(checkIn.subjectKind === subjectKind && checkIn.subjectId === subjectId)
    )
  );
}
