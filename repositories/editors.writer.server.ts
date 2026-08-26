import "server-only";
import { getRedis } from "@/lib/cache";
import editorsSeed from "@/data/editors.json";
import type { Editor, EditorUpdate, NewEditor } from "./editors";

// Deliberately not re-exported from ./index (the shared repository barrel) —
// mirrors editorTransactions.writer.server.ts / mediakit.writer.server.ts.
const EDITORS_KEY = "editors";
const REDIS_NOT_CONFIGURED = "Upstash Redis not configured — set KV_REST_API_URL and KV_REST_API_TOKEN";
const SEED = editorsSeed as Editor[];

async function readEditors(): Promise<Editor[]> {
  const redis = getRedis();
  if (!redis) return SEED;
  const stored = await redis.get<Editor[]>(EDITORS_KEY);
  return stored ?? SEED;
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
  };
  await redis.set(EDITORS_KEY, [...editors, editor]);
}

export async function updateEditor(input: EditorUpdate): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  const editors = await readEditors();
  const name = input.name.trim();
  assertNameAvailable(editors, name, input.id);
  const updated = editors.map((editor): Editor =>
    editor.id === input.id
      ? {
          id: editor.id,
          name,
          phone: input.phone.trim(),
          email: input.email.trim(),
          upi: input.upi.trim(),
          qrImage: input.qrImage,
        }
      : editor
  );
  await redis.set(EDITORS_KEY, updated);
}
