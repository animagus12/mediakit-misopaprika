import "server-only";
import { del, get, list, put } from "@vercel/blob";
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import {
  MAX_BACKUP_BYTES,
  createBackupSnapshot,
  parseBackupSnapshot,
  previewBackup,
  restoreBackupSnapshot,
  type BackupPreview,
  type ParsedBackup,
} from "./backups.server";

const BACKUP_PREFIX = "mediakit-backups/";
const SNAPSHOTS_PER_PAGE = 50;
export const MAX_ONLINE_BACKUPS = 3;
const SNAPSHOT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ENCRYPTED_BACKUP_FORMAT = "mediakit-misopaprika-encrypted-backup";

interface EncryptedBackup {
  format: typeof ENCRYPTED_BACKUP_FORMAT;
  version: 1;
  iv: string;
  authTag: string;
  ciphertext: string;
}

export interface OnlineBackupSummary {
  id: string;
  createdAt: string;
  size: number;
}

export interface OnlineBackupPage {
  snapshots: OnlineBackupSummary[];
  nextCursor: string | null;
}

export function isOnlineBackupConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function requireBlobStore(): void {
  if (!isOnlineBackupConfigured()) {
    throw new Error("Online backups require BLOB_READ_WRITE_TOKEN to be configured.");
  }
}

function getEncryptionKey(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("Online backups require SESSION_SECRET to be configured.");
  return Buffer.from(
    hkdfSync(
      "sha256",
      Buffer.from(secret, "utf8"),
      Buffer.from("mediakit-online-backup-v1", "utf8"),
      Buffer.from("aes-256-gcm", "utf8"),
      32
    )
  );
}

function encryptBackup(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const envelope: EncryptedBackup = {
    format: ENCRYPTED_BACKUP_FORMAT,
    version: 1,
    iv: iv.toString("base64url"),
    authTag: cipher.getAuthTag().toString("base64url"),
    ciphertext: ciphertext.toString("base64url"),
  };
  return JSON.stringify(envelope);
}

function isEncryptedBackup(value: unknown): value is EncryptedBackup {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const envelope = value as Record<string, unknown>;
  return (
    envelope.format === ENCRYPTED_BACKUP_FORMAT &&
    envelope.version === 1 &&
    typeof envelope.iv === "string" &&
    /^[A-Za-z0-9_-]+$/.test(envelope.iv) &&
    Buffer.from(envelope.iv, "base64url").byteLength === 12 &&
    typeof envelope.authTag === "string" &&
    /^[A-Za-z0-9_-]+$/.test(envelope.authTag) &&
    Buffer.from(envelope.authTag, "base64url").byteLength === 16 &&
    typeof envelope.ciphertext === "string" &&
    /^[A-Za-z0-9_-]+$/.test(envelope.ciphertext)
  );
}

function decryptBackup(value: unknown): string {
  if (!isEncryptedBackup(value)) {
    throw new Error("The online backup is not a supported encrypted snapshot.");
  }

  const key = getEncryptionKey();
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(value.iv, "base64url"));
    decipher.setAuthTag(Buffer.from(value.authTag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(value.ciphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch (error) {
    throw new Error(
      "Couldn't decrypt this snapshot. The workspace SESSION_SECRET may have changed or the file may be damaged.",
      { cause: error }
    );
  }
}

function getSnapshotId(pathname: string): string | null {
  if (!pathname.startsWith(BACKUP_PREFIX) || !pathname.endsWith(".json")) return null;
  const id = pathname.slice(BACKUP_PREFIX.length, -".json".length);
  return SNAPSHOT_ID_PATTERN.test(id) ? id : null;
}

async function pruneOnlineBackups(): Promise<void> {
  const blobs: Array<{ pathname: string; uploadedAt: Date; url: string }> = [];
  let cursor: string | undefined;

  do {
    const page = await list({
      prefix: BACKUP_PREFIX,
      limit: 1000,
      ...(cursor ? { cursor } : {}),
    });
    blobs.push(...page.blobs.filter((blob) => getSnapshotId(blob.pathname) !== null));
    if (page.hasMore && !page.cursor) {
      throw new Error("Blob storage did not return a cursor for the next backup page.");
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  blobs.sort(
    (a, b) =>
      b.uploadedAt.getTime() - a.uploadedAt.getTime() ||
      b.pathname.localeCompare(a.pathname)
  );
  const expired = blobs.slice(MAX_ONLINE_BACKUPS);
  if (expired.length > 0) await del(expired.map((blob) => blob.url));
}

export async function createOnlineBackup(): Promise<OnlineBackupSummary> {
  requireBlobStore();
  const snapshot = await createBackupSnapshot();
  const body = encryptBackup(JSON.stringify(snapshot));
  const size = new TextEncoder().encode(body).byteLength;
  if (size > MAX_BACKUP_BYTES) {
    throw new Error("This backup exceeds the 10 MB online snapshot limit.");
  }

  const id = crypto.randomUUID();
  await put(`${BACKUP_PREFIX}${id}.json`, body, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: false,
    contentType: "application/json",
  });
  try {
    await pruneOnlineBackups();
  } catch (error) {
    throw new Error(
      "The online backup was saved, but older snapshots couldn't be removed to enforce the 3-snapshot limit.",
      { cause: error }
    );
  }

  return { id, createdAt: snapshot.exportedAt, size };
}

export async function listOnlineBackups(cursor?: string): Promise<OnlineBackupPage> {
  requireBlobStore();
  await pruneOnlineBackups();
  const page = await list({
    prefix: BACKUP_PREFIX,
    limit: SNAPSHOTS_PER_PAGE,
    ...(cursor ? { cursor } : {}),
  });
  const snapshots = page.blobs.flatMap((blob): OnlineBackupSummary[] => {
    const id = getSnapshotId(blob.pathname);
    return id ? [{ id, createdAt: blob.uploadedAt.toISOString(), size: blob.size }] : [];
  });
  snapshots.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (page.hasMore && !page.cursor) {
    throw new Error("Blob storage did not return a cursor for the next backup page.");
  }
  return { snapshots, nextCursor: page.hasMore ? page.cursor ?? null : null };
}

// Decrypted snapshots go through the same tolerant parseBackupSnapshot as a
// downloaded file, so an online save made before a collection existed still
// restores, with that collection reported as missing in the preview.
async function readOnlineBackup(id: string): Promise<ParsedBackup> {
  requireBlobStore();
  if (!SNAPSHOT_ID_PATTERN.test(id)) throw new Error("Invalid online backup identifier.");

  const result = await get(`${BACKUP_PREFIX}${id}.json`, { access: "public", useCache: false });
  if (!result) throw new Error("That online backup no longer exists.");
  if (result.statusCode !== 200 || result.blob.size > MAX_BACKUP_BYTES) {
    throw new Error("The online backup is empty or exceeds the 10 MB restore limit.");
  }

  const body = await new Response(result.stream).text();
  if (new TextEncoder().encode(body).byteLength > MAX_BACKUP_BYTES) {
    throw new Error("The online backup exceeds the 10 MB restore limit.");
  }

  let encryptedValue: unknown;
  try {
    encryptedValue = JSON.parse(body);
  } catch {
    throw new Error("The online backup file is not valid JSON.");
  }

  const plaintext = decryptBackup(encryptedValue);
  let value: unknown;
  try {
    value = JSON.parse(plaintext);
  } catch {
    throw new Error("The decrypted online backup is not valid JSON.");
  }

  const parsed = parseBackupSnapshot(value);
  if (!parsed) throw new Error("The online backup is not a supported MediaKit backup.");
  return parsed;
}

export async function previewOnlineBackup(id: string): Promise<BackupPreview> {
  return previewBackup(await readOnlineBackup(id));
}

export async function restoreOnlineBackup(id: string): Promise<void> {
  const { snapshot } = await readOnlineBackup(id);
  await restoreBackupSnapshot(snapshot);
}
