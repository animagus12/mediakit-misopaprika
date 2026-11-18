import "server-only";
import { getRedis, readStored } from "@/lib/cache";
import editorsSeed from "@/data/editors.json";
import type { RecordChange } from "@/lib/activityDiff";
import { toNonNegativeInt } from "@/lib/editorTransactions";
import type { Mutation } from "@/lib/storeMutation";
import { mutateStored } from "@/lib/storeWrite.server";
import type { Editor, EditorUpdate, NewEditor } from "./editors";

// server-only, and never imported from a client component: the server
// actions and pages that need it import it directly.
const EDITORS_KEY = "editors";
// Editors saved before revision rates existed carry no rate.
type StoredEditor = Omit<Editor, "revisionRate"> & { revisionRate?: number };

const SEED = editorsSeed as StoredEditor[];

function toEditors(stored: unknown): Editor[] {
  return (Array.isArray(stored) ? (stored as StoredEditor[]) : SEED).map((editor) => ({
    ...editor,
    revisionRate: toNonNegativeInt(editor.revisionRate),
  }));
}

async function readEditors(): Promise<Editor[]> {
  const redis = getRedis();
  return toEditors(redis ? await readStored<unknown>(EDITORS_KEY) : null);
}

// Each write is a compare-and-set over the whole list (see
// lib/storeWrite.server.ts), so two saves that overlap are both kept and the
// name check below sees an editor saved a moment earlier.
function mutateEditors<R>(change: Mutation<Editor[], R>): Promise<R> {
  return mutateStored(EDITORS_KEY, toEditors, change);
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

export function addEditor(input: NewEditor): Promise<void> {
  const name = input.name.trim();
  const editor: Editor = {
    id: crypto.randomUUID(),
    name,
    phone: input.phone.trim(),
    email: input.email.trim(),
    upi: input.upi.trim(),
    qrImage: input.qrImage,
    revisionRate: toNonNegativeInt(input.revisionRate),
  };
  return mutateEditors((editors) => {
    assertNameAvailable(editors, name);
    return { next: [...editors, editor], result: undefined };
  });
}

// Answers the record either side of the write, or null when the id matched
// nothing, so the caller can say what actually changed without re-reading the
// list this already holds. Comparing against the caller's input instead would
// be wrong: the normalising below means a trailing space would read as an edit.
export function updateEditor(input: EditorUpdate): Promise<RecordChange<Editor> | null> {
  const name = input.name.trim();
  return mutateEditors((editors) => {
    assertNameAvailable(editors, name, input.id);
    const before = editors.find((editor) => editor.id === input.id);
    if (!before) return { next: null, result: null };
    const after: Editor = {
      id: before.id,
      name,
      phone: input.phone.trim(),
      email: input.email.trim(),
      upi: input.upi.trim(),
      qrImage: input.qrImage,
      revisionRate: toNonNegativeInt(input.revisionRate),
    };
    return {
      next: editors.map((editor) => (editor.id === input.id ? after : editor)),
      result: { before, after },
    };
  });
}
