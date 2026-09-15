import "server-only";
import { getRedis } from "@/lib/cache";
import editorsSeed from "@/data/editors.json";
import type { RecordChange } from "@/lib/activityDiff";
import { toNonNegativeInt } from "@/lib/editorTransactions";
import type { Editor, EditorUpdate, NewEditor } from "./editors";

// server-only, and never imported from a client component: the server
// actions and pages that need it import it directly.
const EDITORS_KEY = "editors";
const REDIS_NOT_CONFIGURED = "Upstash Redis not configured: set KV_REST_API_URL and KV_REST_API_TOKEN";
// Editors saved before revision rates existed carry no rate.
type StoredEditor = Omit<Editor, "revisionRate"> & { revisionRate?: number };

const SEED = editorsSeed as StoredEditor[];

async function readEditors(): Promise<Editor[]> {
  const redis = getRedis();
  const stored = redis ? await redis.get<StoredEditor[]>(EDITORS_KEY) : null;
  return (stored ?? SEED).map((editor) => ({ ...editor, revisionRate: toNonNegativeInt(editor.revisionRate) }));
}

// Falls back to the bundled data/editors.json seed until the first editor
// is added, or whenever Redis isn't configured (e.g. local dev without KV
// env vars).
export async function getEditors(): Promise<Editor[]> {
  return readEditors();
}

function assertNameAvailable(editors: Editor[], name: string, excludeId?: string): void {
  const clash = editors.some(
    (editor) => editor.id !== excludeId && editor.name.trim().toLowerCase() === name.toLowerCase()
  );
  if (clash) throw new Error(`"${name}" is already in the editors list`);
}

export async function addEditor(input: NewEditor): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  const editors = await readEditors();
  const name = input.name.trim();
  assertNameAvailable(editors, name);
  const editor: Editor = {
    id: crypto.randomUUID(),
    name,
    phone: input.phone.trim(),
    email: input.email.trim(),
    upi: input.upi.trim(),
    qrImage: input.qrImage,
    revisionRate: toNonNegativeInt(input.revisionRate),
  };
  await redis.set(EDITORS_KEY, [...editors, editor]);
}

// Answers the record either side of the write, or null when the id matched
// nothing, so the caller can say what actually changed without re-reading the
// list this already holds. Comparing against the caller's input instead would
// be wrong: the normalising below means a trailing space would read as an edit.
export async function updateEditor(input: EditorUpdate): Promise<RecordChange<Editor> | null> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  const editors = await readEditors();
  const name = input.name.trim();
  assertNameAvailable(editors, name, input.id);
  const before = editors.find((editor) => editor.id === input.id);
  if (!before) return null;
  const after: Editor = {
    id: before.id,
    name,
    phone: input.phone.trim(),
    email: input.email.trim(),
    upi: input.upi.trim(),
    qrImage: input.qrImage,
    revisionRate: toNonNegativeInt(input.revisionRate),
  };
  await redis.set(EDITORS_KEY, editors.map((editor) => (editor.id === input.id ? after : editor)));
  return { before, after };
}
