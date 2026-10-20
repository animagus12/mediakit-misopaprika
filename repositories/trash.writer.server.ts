import "server-only";
import { getRedis } from "@/lib/cache";
import type { TrashEntry, TrashPayload } from "./trash";
import type { LinkTrashTarget } from "./trash";

const TRASH_KEY = "trash";
const REDIS_NOT_CONFIGURED = "Upstash Redis not configured: set KV_REST_API_URL and KV_REST_API_TOKEN";

async function readTrash(): Promise<TrashEntry[]> {
  const redis = getRedis();
  if (!redis) return [];
  return (await redis.get<TrashEntry[]>(TRASH_KEY)) ?? [];
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

export async function addTrashEntry(payload: TrashPayload, label: string): Promise<string> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  const entries = await readTrash();
  const entry: TrashEntry = {
    id: crypto.randomUUID(),
    label,
    deletedAt: new Date().toISOString(),
    status: "pending",
    payload,
  };
  await redis.set(TRASH_KEY, [...entries, entry]);
  return entry.id;
}

export async function activateTrashEntry(id: string): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  const entries = await readTrash();
  const found = entries.some((entry) => entry.id === id);
  if (!found) throw new Error("Trash snapshot no longer exists");
  await redis.set(
    TRASH_KEY,
    entries.map((entry) => (entry.id === id ? { ...entry, status: "ready" } : entry))
  );
}

export async function setTrashEntryTargets(id: string, targets: LinkTrashTarget[]): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  const entries = await readTrash();
  const found = entries.some((entry) => entry.id === id);
  if (!found) throw new Error("Trash snapshot no longer exists");
  await redis.set(
    TRASH_KEY,
    entries.map((entry) =>
      entry.id === id && (entry.payload.type === "linksSection" ||
        entry.payload.type === "linksItem" ||
        entry.payload.type === "linksSocial")
        ? { ...entry, payload: { ...entry.payload, targets } }
        : entry
    )
  );
}

export async function removeTrashEntry(id: string): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  const entries = await readTrash();
  await redis.set(
    TRASH_KEY,
    entries.filter((entry) => entry.id !== id)
  );
}

export async function clearTrash(): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  await redis.set(TRASH_KEY, []);
}
