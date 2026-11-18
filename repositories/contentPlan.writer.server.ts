import "server-only";
import { getRedis, readStored } from "@/lib/cache";
import contentPlanSeed from "@/data/content-plan.json";
import type { RecordChange } from "@/lib/activityDiff";
import type { Mutation } from "@/lib/storeMutation";
import { mutateStored } from "@/lib/storeWrite.server";
import { toContentItem, toContentStatus } from "./contentPlan";
import type {
  ContentItem,
  ContentItemRecord,
  ContentItemUpdate,
  ContentStatus,
  NewContentItem,
} from "./contentPlan";

// server-only, and never imported from a client component: the server actions
// and pages that need it import it directly. Same whole-array store as every
// other one here (the activity log is the one exception, and for a reason
// that doesn't apply to a list this size), and the same compare-and-set on
// every write (see lib/storeWrite.server.ts).
const CONTENT_PLAN_KEY = "content_plan";
const SEED = contentPlanSeed as ContentItemRecord[];

// Statuses are coerced on the way out, the way the campaigns store coerces
// its own, so an entry saved as "Dropped" before the vocabularies were merged
// reads as Cancelled everywhere and is healed on the next write.
function toRecords(stored: unknown): ContentItemRecord[] {
  return (Array.isArray(stored) ? (stored as ContentItemRecord[]) : SEED).map((record) => ({
    ...record,
    status: toContentStatus(record.status),
  }));
}

async function readRecords(): Promise<ContentItemRecord[]> {
  const redis = getRedis();
  return toRecords(redis ? await readStored<unknown>(CONTENT_PLAN_KEY) : null);
}

function mutateRecords<R>(change: Mutation<ContentItemRecord[], R>): Promise<R> {
  return mutateStored(CONTENT_PLAN_KEY, toRecords, change);
}

// Falls back to the bundled data/content-plan.json seed (an empty list: unlike
// the other stores there is no spreadsheet history to carry over) until the
// first write, or whenever Redis isn't configured.
export async function getContentItems(): Promise<ContentItem[]> {
  return (await readRecords()).map(toContentItem);
}

export async function getContentItemRecord(id: string): Promise<ContentItemRecord | null> {
  return (await readRecords()).find((record) => record.id === id) ?? null;
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

export function addContentItem(input: NewContentItem): Promise<ContentItemRecord> {
  const record: ContentItemRecord = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...normalize(input),
  };
  return mutateRecords((records) => ({ next: [...records, record], result: record }));
}

// Rewrites one item through `update`. Answers the record either side of the
// write, or null when the id matched nothing, so the caller can say what
// actually changed without re-reading the list this already holds.
function replaceRecord(
  id: string,
  update: (before: ContentItemRecord) => ContentItemRecord
): Promise<RecordChange<ContentItemRecord> | null> {
  return mutateRecords((records) => {
    const before = records.find((record) => record.id === id);
    if (!before) return { next: null, result: null };
    const after = update(before);
    return { next: records.map((record) => (record.id === id ? after : record)), result: { before, after } };
  });
}

// createdAt is carried through untouched: it is what ages an idea in the
// backlog, and an edit is not a re-creation.
export function updateContentItem(
  input: ContentItemUpdate
): Promise<RecordChange<ContentItemRecord> | null> {
  return replaceRecord(input.id, (before) => ({ ...before, ...normalize(input) }));
}

// Answers the record it removed, since a caller cannot read back a title once
// the row is gone and the activity event has to name it.
export function deleteContentItem(id: string): Promise<ContentItemRecord | null> {
  return mutateRecords((records) => {
    const removed = records.find((record) => record.id === id);
    if (!removed) return { next: null, result: null };
    return { next: records.filter((record) => record.id !== id), result: removed };
  });
}

export function restoreContentItem(record: ContentItemRecord): Promise<void> {
  return mutateRecords((records) => ({
    next: records.some((entry) => entry.id === record.id) ? null : [...records, record],
    result: undefined,
  }));
}

// Writes just the posting day, leaving every other field untouched: the
// calendar's inline scheduler, and the counterpart of setCampaignUploadDate
// for this store. "" puts the item back in the ideas backlog.
export function setContentItemDate(
  id: string,
  postDate: string
): Promise<RecordChange<ContentItemRecord> | null> {
  return replaceRecord(id, (before) => ({ ...before, postDate: postDate.trim() }));
}

// Writes just the production status: the board's drag between stages. The
// counterpart of setContentItemDate, and for the same reason: a card moved
// from a list must not be able to overwrite the fields the list doesn't show.
export function setContentItemStatus(
  id: string,
  status: ContentStatus
): Promise<RecordChange<ContentItemRecord> | null> {
  return replaceRecord(id, (before) => ({ ...before, status }));
}
