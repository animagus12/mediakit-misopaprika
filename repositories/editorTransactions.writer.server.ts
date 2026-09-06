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
import { toSheetDate } from "@/lib/editorTransactions";

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

export async function updateEditorTransaction(input: EditorTransactionUpdate): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  const records = await readRecords();
  const updated = records.map((record): EditorTransactionRecord =>
    record.id === input.id
      ? {
          id: record.id,
          video: input.video.trim(),
          videoDate: toSheetDate(input.videoDate),
          deliveryDate: toSheetDate(input.deliveryDate),
          amount: input.amount,
          editor: input.editor.trim(),
          status: input.status,
        }
      : record
  );
  await redis.set(EDITOR_TRANSACTIONS_KEY, updated);
}

export async function deleteEditorTransaction(id: string): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  const records = await readRecords();
  await redis.set(
    EDITOR_TRANSACTIONS_KEY,
    records.filter((record) => record.id !== id)
  );
}
