import "server-only";
import { getRedis } from "@/lib/cache";
import contentPlanSeed from "@/data/content-plan.json";
import type { RecordChange } from "@/lib/activityDiff";
import { toContentItem } from "./contentPlan";
import type {
  ContentItem,
  ContentItemRecord,
  ContentItemUpdate,
  NewContentItem,
} from "./contentPlan";

// server-only, and never imported from a client component: the server actions
// and pages that need it import it directly. Same whole-array read-modify-write
// as every other store here (the activity log is the one exception, and for a
// reason that doesn't apply to a list this size).
const CONTENT_PLAN_KEY = "content_plan";
const REDIS_NOT_CONFIGURED = "Upstash Redis not configured: set KV_REST_API_URL and KV_REST_API_TOKEN";
const SEED = contentPlanSeed as ContentItemRecord[];

async function readRecords(): Promise<ContentItemRecord[]> {
  const redis = getRedis();
  if (!redis) return SEED;
  const stored = await redis.get<ContentItemRecord[]>(CONTENT_PLAN_KEY);
  return stored ?? SEED;
}

// Falls back to the bundled data/content-plan.json seed (an empty list: unlike
// the other stores there is no spreadsheet history to carry over) until the
// first write, or whenever Redis isn't configured.
export async function getContentItems(): Promise<ContentItem[]> {
  return (await readRecords()).map(toContentItem);
}

// Trims free text so a record is clean regardless of what the form handed
// over: same defensive shape as the other writers here. format and status are
// closed unions, so there is nothing to normalise about them.
function normalize(input: NewContentItem): Omit<ContentItemRecord, "id" | "createdAt"> {
  return {
    title: input.title.trim(),
    format: input.format,
    status: input.status,
    postDate: input.postDate.trim(),
    notes: input.notes.trim(),
    editorTransactionId: input.editorTransactionId,
  };
}

export async function addContentItem(input: NewContentItem): Promise<ContentItemRecord> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  const records = await readRecords();
  const record: ContentItemRecord = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...normalize(input),
  };
  await redis.set(CONTENT_PLAN_KEY, [...records, record]);
  return record;
}

// Answers the record either side of the write, or null when the id matched
// nothing, so the caller can say what actually changed without re-reading the
// list this already holds. createdAt is carried through untouched: it is what
// ages an idea in the backlog, and an edit is not a re-creation.
export async function updateContentItem(
  input: ContentItemUpdate
): Promise<RecordChange<ContentItemRecord> | null> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  const records = await readRecords();
  const before = records.find((record) => record.id === input.id);
  if (!before) return null;
  const after: ContentItemRecord = { ...before, ...normalize(input) };
  await redis.set(
    CONTENT_PLAN_KEY,
    records.map((record) => (record.id === input.id ? after : record))
  );
  return { before, after };
}

// Answers the record it removed, since a caller cannot read back a title once
// the row is gone and the activity event has to name it.
export async function deleteContentItem(id: string): Promise<ContentItemRecord | null> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  const records = await readRecords();
  const removed = records.find((record) => record.id === id);
  if (!removed) return null;
  await redis.set(CONTENT_PLAN_KEY, records.filter((record) => record.id !== id));
  return removed;
}

// Writes just the posting day, leaving every other field untouched: the
// calendar's inline scheduler, and the counterpart of setCampaignUploadDate
// for this store. "" puts the item back in the ideas backlog.
export async function setContentItemDate(
  id: string,
  postDate: string
): Promise<RecordChange<ContentItemRecord> | null> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  const records = await readRecords();
  const before = records.find((record) => record.id === id);
  if (!before) return null;
  const after: ContentItemRecord = { ...before, postDate: postDate.trim() };
  await redis.set(
    CONTENT_PLAN_KEY,
    records.map((record) => (record.id === id ? after : record))
  );
  return { before, after };
}
