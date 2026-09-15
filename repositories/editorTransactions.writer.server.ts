import "server-only";
import { getRedis } from "@/lib/cache";
import editorTransactionsSeed from "@/data/editor-transactions.json";
import { toEditorTransaction } from "./editorTransactions";
import type {
  EditorTransaction,
  EditorTransactionRecord,
  EditorTransactionUpdate,
  NewEditorTransaction,
} from "./editorTransactions";
import { applyRevisionChange, toNonNegativeInt, toSheetDate } from "@/lib/editorTransactions";
import type { RecordChange } from "@/lib/activityDiff";

// server-only, and never imported from a client component: the server
// actions and pages that need it import it directly. Reading/writing
// transactions goes through Redis (Vercel's serverless filesystem is
// read-only), so that logic lives here rather than in ./editorTransactions.
const EDITOR_TRANSACTIONS_KEY = "editor_transactions";
const REDIS_NOT_CONFIGURED = "Upstash Redis not configured: set KV_REST_API_URL and KV_REST_API_TOKEN";
const SEED = editorTransactionsSeed as EditorTransactionRecord[];

async function readRecords(): Promise<EditorTransactionRecord[]> {
  const redis = getRedis();
  if (!redis) return SEED;
  const stored = await redis.get<EditorTransactionRecord[]>(EDITOR_TRANSACTIONS_KEY);
  return stored ?? SEED;
}

// Falls back to the bundled data/editor-transactions.json seed until the
// first transaction is added, or whenever Redis isn't configured (e.g.
// local dev without KV env vars).
export async function getEditorTransactions(): Promise<EditorTransaction[]> {
  const records = await readRecords();
  return records.map(toEditorTransaction);
}

export async function addEditorTransaction(input: NewEditorTransaction): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  const records = await readRecords();
  const record: EditorTransactionRecord = {
    id: crypto.randomUUID(),
    video: input.video.trim(),
    videoDate: toSheetDate(input.videoDate),
    deliveryDate: toSheetDate(input.deliveryDate),
    amount: input.amount,
    editor: input.editor.trim(),
    status: input.status,
    ...revisionFields(input),
  };
  await redis.set(EDITOR_TRANSACTIONS_KEY, [...records, record]);
}

/**
 * Repoints every transaction filed under `from` to `to`.
 *
 * EditorTransaction.editor stores the editor's *name*, not their id, and
 * computeEditorPayoutSummary() matches it with an exact string compare. So a
 * rename in the editors list silently detaches that editor's whole history
 * and zeroes their payout unless the transactions move with it. Called by
 * updateEditor for exactly that reason.
 *
 * Returns how many transactions moved, so the caller can skip revalidating
 * when a rename touched nothing.
 */
export async function renameEditorOnTransactions(from: string, to: string): Promise<number> {
  const before = from.trim();
  const after = to.trim();
  if (!before || !after || before === after) return 0;

  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  const records = await readRecords();
  if (!records.some((record) => record.editor.trim() === before)) return 0;

  let moved = 0;
  const updated = records.map((record): EditorTransactionRecord => {
    if (record.editor.trim() !== before) return record;
    moved += 1;
    return { ...record, editor: after };
  });
  await redis.set(EDITOR_TRANSACTIONS_KEY, updated);
  return moved;
}

// The form sends the count and the rate its stepper charged at; a rate is
// only kept while there are revisions for it to describe.
function revisionFields(input: { revisions: number; revisionRate: number | null }) {
  const revisions = toNonNegativeInt(input.revisions);
  return {
    revisions,
    revisionRate: revisions > 0 && input.revisionRate != null ? toNonNegativeInt(input.revisionRate) : null,
  };
}

// Rewrites one record through `update`. Answers the record either side of the
// write, or null when the id matched nothing, so the caller can say what
// actually changed without re-reading the list this already holds. Comparing
// against the caller's input instead would be wrong: the normalising in each
// update means a trailing space would read as an edit.
async function replaceRecord(
  id: string,
  update: (before: EditorTransactionRecord) => EditorTransactionRecord
): Promise<RecordChange<EditorTransactionRecord> | null> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  const records = await readRecords();
  const before = records.find((record) => record.id === id);
  if (!before) return null;
  const after = update(before);
  await redis.set(
    EDITOR_TRANSACTIONS_KEY,
    records.map((record) => (record.id === id ? after : record))
  );
  return { before, after };
}

export async function updateEditorTransaction(
  input: EditorTransactionUpdate
): Promise<RecordChange<EditorTransactionRecord> | null> {
  return replaceRecord(input.id, (before) => ({
    id: before.id,
    video: input.video.trim(),
    videoDate: toSheetDate(input.videoDate),
    deliveryDate: toSheetDate(input.deliveryDate),
    amount: input.amount,
    editor: input.editor.trim(),
    status: input.status,
    ...revisionFields(input),
  }));
}

// Status only, for the table's inline select: nothing else on the record is
// read from the client, so a stale row can't write back old values.
export async function setEditorTransactionStatus(
  id: string,
  status: string
): Promise<RecordChange<EditorTransactionRecord> | null> {
  return replaceRecord(id, (before) => ({ ...before, status }));
}

/**
 * Adds or takes back revisions, moving the amount with them (see
 * applyRevisionChange). The rate is looked up here, from the record's own
 * editor at the time of the write, rather than trusted from the client.
 */
export async function changeEditorTransactionRevisions(
  id: string,
  delta: number,
  rateForEditor: (editorName: string) => number
): Promise<RecordChange<EditorTransactionRecord> | null> {
  return replaceRecord(id, (before) => {
    const current = toEditorTransaction(before);
    return { ...before, ...applyRevisionChange(current, delta, rateForEditor(before.editor)) };
  });
}

// Returns the transaction it removed, or null when the id matched nothing:
// see deleteBrand in brands.writer.server.ts for why.
export async function deleteEditorTransaction(id: string): Promise<EditorTransactionRecord | null> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  const records = await readRecords();
  const removed = records.find((record) => record.id === id) ?? null;
  await redis.set(
    EDITOR_TRANSACTIONS_KEY,
    records.filter((record) => record.id !== id)
  );
  return removed;
}
