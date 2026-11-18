import "server-only";
import { getRedis, readStored } from "@/lib/cache";
import type { Mutation } from "@/lib/storeMutation";
import { mutateStored } from "@/lib/storeWrite.server";
import type { LinkTrashTarget, TrashEntry, TrashPayload } from "./trash";

const TRASH_KEY = "trash";

function toTrash(stored: unknown): TrashEntry[] {
  return Array.isArray(stored) ? (stored as TrashEntry[]) : [];
}

async function readTrash(): Promise<TrashEntry[]> {
  const redis = getRedis();
  if (!redis) return [];
  return toTrash(await readStored<unknown>(TRASH_KEY));
}

// Every write is a compare-and-set over the whole list (see
// lib/storeWrite.server.ts): a delete's snapshot landing while another is
// activated or removed is kept rather than dropped, which would take that
// delete's undo with it.
function mutateTrash<R>(change: Mutation<TrashEntry[], R>): Promise<R> {
  return mutateStored(TRASH_KEY, toTrash, change);
}

export async function listTrash(): Promise<TrashEntry[]> {
  return (await readTrash())
    .filter((entry) => entry.status === "ready")
    .sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
}

export async function getTrashEntry(id: string): Promise<TrashEntry | null> {
  return (await readTrash()).find((entry) => entry.id === id) ?? null;
}

export async function getTrashedCampaignIds(): Promise<string[]> {
  return (await readTrash())
    .flatMap((entry) => entry.payload.type === "campaign" ? [entry.payload.record.id] : []);
}

export function addTrashEntry(payload: TrashPayload, label: string): Promise<string> {
  const entry: TrashEntry = {
    id: crypto.randomUUID(),
    label,
    deletedAt: new Date().toISOString(),
    status: "pending",
    payload,
  };
  return mutateTrash((entries) => ({ next: [...entries, entry], result: entry.id }));
}

export function activateTrashEntry(id: string): Promise<void> {
  return mutateTrash((entries) => {
    const found = entries.some((entry) => entry.id === id);
    if (!found) throw new Error("Trash snapshot no longer exists");
    return {
      next: entries.map((entry): TrashEntry => (entry.id === id ? { ...entry, status: "ready" } : entry)),
      result: undefined,
    };
  });
}

export function setTrashEntryTargets(id: string, targets: LinkTrashTarget[]): Promise<void> {
  return mutateTrash((entries) => {
    const found = entries.some((entry) => entry.id === id);
    if (!found) throw new Error("Trash snapshot no longer exists");
    return {
      next: entries.map((entry) =>
        entry.id === id && (entry.payload.type === "linksSection" ||
          entry.payload.type === "linksItem" ||
          entry.payload.type === "linksSocial")
          ? { ...entry, payload: { ...entry.payload, targets } }
          : entry
      ),
      result: undefined,
    };
  });
}

export function removeTrashEntry(id: string): Promise<void> {
  return mutateTrash((entries) => ({
    next: entries.some((entry) => entry.id === id) ? entries.filter((entry) => entry.id !== id) : null,
    result: undefined,
  }));
}

export function clearTrash(): Promise<void> {
  return mutateTrash((entries) => ({ next: entries.length > 0 ? [] : null, result: undefined }));
}
