import "server-only";
import { revalidatePath } from "next/cache";
import { getRedis } from "@/lib/cache";
import { revalidateStores } from "@/lib/revalidation";

export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
const BACKUP_FORMAT = "mediakit-misopaprika-backup";
const BACKUP_VERSION = 1;
const MAX_ACTIVITY_ENTRIES = 500;

const ARRAY_KEYS = [
  "affiliate_partners",
  "affiliate_payouts",
  "agencies",
  "brand_notes",
  "brands",
  "campaign_contacts",
  "campaigns",
  "content_plan",
  "contacts",
  "editor_transactions",
  "editors",
  "invoices",
  "trash",
] as const;

const OBJECT_KEYS = [
  "invoice_draft",
  "links_draft",
  "links_published",
  "mediakit_draft",
  "mediakit_published",
] as const;

const JSON_KEYS = [...ARRAY_KEYS, ...OBJECT_KEYS] as const;
const RECORD_KEYS = [...JSON_KEYS, "activity"] as const;
type RecordKey = (typeof RECORD_KEYS)[number];
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
type JsonObject = { [key: string]: JsonValue };

export interface BackupSnapshot {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  records: Record<Exclude<RecordKey, "activity">, JsonValue | null> & { activity: JsonObject[] };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJsonValue(value: unknown, depth = 0): value is JsonValue {
  if (depth > 100) return false;
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every((item) => isJsonValue(item, depth + 1));
  return isObject(value) && Object.values(value).every((item) => isJsonValue(item, depth + 1));
}

function isJsonObject(value: unknown): value is JsonObject {
  return isObject(value) && Object.values(value).every((item) => isJsonValue(item));
}

function isBackupSnapshot(value: unknown): value is BackupSnapshot {
  if (
    !isObject(value) ||
    value.format !== BACKUP_FORMAT ||
    value.version !== BACKUP_VERSION ||
    typeof value.exportedAt !== "string" ||
    !Number.isFinite(Date.parse(value.exportedAt)) ||
    !isObject(value.records)
  ) {
    return false;
  }

  const keys = Object.keys(value.records);
  if (keys.length !== RECORD_KEYS.length || !RECORD_KEYS.every((key) => keys.includes(key))) {
    return false;
  }

  const records = value.records;
  if (
    !ARRAY_KEYS.every(
      (key) =>
        (records[key] === null || Array.isArray(records[key])) &&
        (records[key] === null || records[key].every(isJsonObject))
    ) ||
    !OBJECT_KEYS.every((key) => records[key] === null || isObject(records[key])) ||
    !Array.isArray(records.activity) ||
    records.activity.length > MAX_ACTIVITY_ENTRIES ||
    !records.activity.every(isJsonObject) ||
    !RECORD_KEYS.every((key) => isJsonValue(records[key]))
  ) {
    return false;
  }

  return true;
}

export function parseBackupSnapshot(value: unknown): BackupSnapshot | null {
  return isBackupSnapshot(value) ? value : null;
}

export async function createBackupSnapshot(): Promise<BackupSnapshot> {
  const redis = getRedis();
  if (!redis) throw new Error("Backup and restore require a configured Upstash Redis store.");

  const [values, activity] = await Promise.all([
    Promise.all(JSON_KEYS.map((key) => redis.get<JsonValue>(key))),
    redis.lrange<JsonObject>("activity", 0, MAX_ACTIVITY_ENTRIES - 1),
  ]);
  const records = Object.fromEntries(
    JSON_KEYS.map((key, index) => [key, values[index]])
  ) as Record<Exclude<RecordKey, "activity">, JsonValue | null>;

  const snapshot = parseBackupSnapshot({
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    records: { ...records, activity },
  });
  if (!snapshot) throw new Error("Stored workspace data is not in a supported backup format.");
  return snapshot;
}

export async function restoreBackupSnapshot(snapshot: BackupSnapshot): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new Error("Backup and restore require a configured Upstash Redis store.");

  const transaction = redis.multi();
  for (const key of JSON_KEYS) {
    const record = snapshot.records[key];
    if (record === null) transaction.del(key);
    else transaction.set(key, record);
  }

  transaction.del("activity");
  if (snapshot.records.activity.length > 0) {
    transaction.lpush("activity", ...[...snapshot.records.activity].reverse());
    transaction.ltrim("activity", 0, MAX_ACTIVITY_ENTRIES - 1);
  }
  await transaction.exec();

  revalidateStores(
    "campaigns",
    "contentPlan",
    "invoices",
    "brands",
    "contacts",
    "agencies",
    "editors",
    "editorTransactions",
    "affiliatePartners",
    "affiliatePayouts",
    "brandNotes",
    "campaignContacts",
    "invoiceDefaults"
  );
  for (const path of ["/", "/mediakit", "/links", "/mediakit-generator", "/links-editor", "/activity", "/trash"]) {
    revalidatePath(path);
  }
}
