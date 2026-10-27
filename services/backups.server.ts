import "server-only";
import { revalidatePath } from "next/cache";
import { getRedis } from "@/lib/cache";
import { revalidateStores } from "@/lib/revalidation";

export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
const BACKUP_FORMAT = "mediakit-misopaprika-backup";
// Version 2 is the first format allowed to leave collections out. Version 1
// files always carried every collection that existed when they were written,
// so both read the same way: anything absent is a collection added since.
const BACKUP_VERSION = 2;
type BackupVersion = 1 | typeof BACKUP_VERSION;
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
  "expenses",
  "invoices",
  "payments",
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
type JsonKey = Exclude<RecordKey, "activity">;
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
type JsonObject = { [key: string]: JsonValue };

// What the restore preview calls a collection the backup does not contain.
// Typed against RecordKey so a new collection cannot ship without a label.
const RECORD_LABELS: Record<RecordKey, string> = {
  affiliate_partners: "Affiliate partners",
  affiliate_payouts: "Affiliate payouts",
  agencies: "Agencies",
  brand_notes: "Brand notes",
  brands: "Brands",
  campaign_contacts: "Campaign contacts",
  campaigns: "Campaigns",
  content_plan: "Calendar items",
  contacts: "Contacts",
  editor_transactions: "Editor transactions",
  editors: "Editors",
  expenses: "Expenses",
  invoices: "Invoices",
  payments: "Payments",
  trash: "Trash",
  invoice_draft: "Invoice defaults",
  links_draft: "Links draft",
  links_published: "Published links",
  mediakit_draft: "Media kit draft",
  mediakit_published: "Published media kit",
  activity: "Activity log",
};

export interface BackupSnapshot {
  format: typeof BACKUP_FORMAT;
  version: BackupVersion;
  exportedAt: string;
  records: Record<JsonKey, JsonValue | null> & { activity: JsonObject[] };
}

/**
 * A backup that passed validation. `snapshot.records` always holds every
 * collection this build knows: one the file left out is filled in as null
 * (an empty list for activity), which restore already treats as "clear it".
 * `missingKeys` remembers which ones those were so the preview can say so.
 */
export interface ParsedBackup {
  snapshot: BackupSnapshot;
  missingKeys: RecordKey[];
}

export interface BackupPreview {
  exportedAt: string;
  counts: {
    brands: number;
    campaigns: number;
    invoices: number;
    payments: number;
    expenses: number;
    calendarItems: number;
    contacts: number;
    agencies: number;
    affiliatePartners: number;
    affiliatePayouts: number;
    editorTransactions: number;
    editors: number;
    brandNotes: number;
    campaignContacts: number;
    trashEntries: number;
    activityEntries: number;
    invoiceDefaultsSaved: boolean;
    linksDraftSaved: boolean;
    linksPublishedSaved: boolean;
    mediaKitDraftSaved: boolean;
    mediaKitPublishedSaved: boolean;
  };
  // Labels of the collections the backup does not contain. Restoring clears
  // them in this workspace, so the restore dialog lists them before confirming.
  missingCollections: string[];
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

function isSupportedVersion(value: unknown): value is BackupVersion {
  return value === 1 || value === BACKUP_VERSION;
}

function isRecordKey(key: string): key is RecordKey {
  return (RECORD_KEYS as readonly string[]).includes(key);
}

function isArrayRecord(value: unknown): value is JsonObject[] | null {
  return value === null || (Array.isArray(value) && value.every(isJsonObject));
}

function isObjectRecord(value: unknown): value is JsonValue | null {
  return value === null || (isObject(value) && isJsonValue(value));
}

function isActivityRecord(value: unknown): value is JsonObject[] {
  return Array.isArray(value) && value.length <= MAX_ACTIVITY_ENTRIES && value.every(isJsonObject);
}

/**
 * Accepts any supported version holding a subset of the known collections,
 * so adding a collection later never strands the backups made before it.
 * A collection the file leaves out is reported in missingKeys and cleared on
 * restore. A key this build does not know (a file from a newer build, or a
 * newer version number) is rejected: restoring it would silently drop data
 * the file does carry.
 */
export function parseBackupSnapshot(value: unknown): ParsedBackup | null {
  if (
    !isObject(value) ||
    value.format !== BACKUP_FORMAT ||
    !isSupportedVersion(value.version) ||
    typeof value.exportedAt !== "string" ||
    !Number.isFinite(Date.parse(value.exportedAt)) ||
    !isObject(value.records)
  ) {
    return null;
  }

  const source = value.records;
  const presentKeys = Object.keys(source);
  // An empty records object is a damaged file rather than a backup of
  // nothing: restoring it would clear the whole workspace.
  if (presentKeys.length === 0 || !presentKeys.every(isRecordKey)) return null;

  const present = new Set<string>(presentKeys);
  const records = {} as Record<JsonKey, JsonValue | null>;
  for (const key of ARRAY_KEYS) {
    const record = present.has(key) ? source[key] : null;
    if (!isArrayRecord(record)) return null;
    records[key] = record;
  }
  for (const key of OBJECT_KEYS) {
    const record = present.has(key) ? source[key] : null;
    if (!isObjectRecord(record)) return null;
    records[key] = record;
  }
  const activity = present.has("activity") ? source.activity : [];
  if (!isActivityRecord(activity)) return null;

  return {
    snapshot: {
      format: BACKUP_FORMAT,
      version: value.version,
      exportedAt: value.exportedAt,
      records: { ...records, activity },
    },
    missingKeys: RECORD_KEYS.filter((key) => !present.has(key)),
  };
}

function recordCount(value: JsonValue | null): number {
  return Array.isArray(value) ? value.length : 0;
}

/** The summary the restore dialog shows, for a downloaded file or an online snapshot alike. */
export function previewBackup({ snapshot, missingKeys }: ParsedBackup): BackupPreview {
  const records = snapshot.records;
  return {
    exportedAt: snapshot.exportedAt,
    counts: {
      brands: recordCount(records.brands),
      campaigns: recordCount(records.campaigns),
      invoices: recordCount(records.invoices),
      payments: recordCount(records.payments),
      expenses: recordCount(records.expenses),
      calendarItems: recordCount(records.content_plan),
      contacts: recordCount(records.contacts),
      agencies: recordCount(records.agencies),
      affiliatePartners: recordCount(records.affiliate_partners),
      affiliatePayouts: recordCount(records.affiliate_payouts),
      editorTransactions: recordCount(records.editor_transactions),
      editors: recordCount(records.editors),
      brandNotes: recordCount(records.brand_notes),
      campaignContacts: recordCount(records.campaign_contacts),
      trashEntries: recordCount(records.trash),
      activityEntries: records.activity.length,
      invoiceDefaultsSaved: records.invoice_draft !== null,
      linksDraftSaved: records.links_draft !== null,
      linksPublishedSaved: records.links_published !== null,
      mediaKitDraftSaved: records.mediakit_draft !== null,
      mediaKitPublishedSaved: records.mediakit_published !== null,
    },
    missingCollections: missingKeys.map((key) => RECORD_LABELS[key]),
  };
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
  ) as Record<JsonKey, JsonValue | null>;

  const parsed = parseBackupSnapshot({
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    records: { ...records, activity },
  });
  if (!parsed) throw new Error("Stored workspace data is not in a supported backup format.");
  return parsed.snapshot;
}

/**
 * Every collection is written or cleared in one MULTI, so a restore never
 * leaves the workspace half old and half new. A collection the backup did not
 * contain arrives here as null (parseBackupSnapshot fills it in) and is
 * cleared, exactly like one that was empty when the backup was made.
 */
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
    "payments",
    "expenses",
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
