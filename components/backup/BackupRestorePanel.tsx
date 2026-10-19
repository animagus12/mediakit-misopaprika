"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Cloud, DatabaseBackup, Download, Eye, RefreshCw, RotateCcw, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { todayKey } from "@/lib/day";
import { formatTimestampIST } from "@/lib/time";

const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
const PREVIEW_COUNT_LABELS = [
  ["brands", "Brands"],
  ["campaigns", "Campaigns"],
  ["invoices", "Invoices"],
  ["calendarItems", "Calendar items"],
  ["contacts", "Contacts"],
  ["agencies", "Agencies"],
  ["affiliatePartners", "Affiliate partners"],
  ["affiliatePayouts", "Affiliate payouts"],
  ["editorTransactions", "Editor transactions"],
  ["editors", "Editors"],
  ["brandNotes", "Brand notes"],
  ["campaignContacts", "Campaign contacts"],
  ["trashEntries", "Trash entries"],
  ["activityEntries", "Activity entries"],
] as const;
const PREVIEW_SAVED_LABELS = [
  ["invoiceDefaultsSaved", "Invoice defaults"],
  ["linksDraftSaved", "Links draft"],
  ["linksPublishedSaved", "Published links"],
  ["mediaKitDraftSaved", "Media kit draft"],
  ["mediaKitPublishedSaved", "Published media kit"],
] as const;

interface OnlineBackup {
  id: string;
  createdAt: string;
  size: number;
}

function isOnlineBackupPreview(value: unknown): value is OnlineBackupPreview {
  if (typeof value !== "object" || value === null || !("exportedAt" in value) || !("counts" in value)) {
    return false;
  }
  if (
    typeof value.exportedAt !== "string" ||
    !Number.isFinite(Date.parse(value.exportedAt)) ||
    typeof value.counts !== "object" ||
    value.counts === null ||
    Array.isArray(value.counts)
  ) {
    return false;
  }
  const counts = value.counts as Record<string, unknown>;
  return (
    PREVIEW_COUNT_LABELS.every(
      ([key]) => key in counts && typeof counts[key] === "number" && Number.isFinite(counts[key])
    ) &&
    PREVIEW_SAVED_LABELS.every(([key]) => key in counts && typeof counts[key] === "boolean")
  );
}

interface OnlineBackupPage {
  snapshots: OnlineBackup[];
  nextCursor: string | null;
}

interface OnlineBackupPreview {
  exportedAt: string;
  counts: {
    brands: number;
    campaigns: number;
    invoices: number;
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
}

type RestoreSource =
  | { type: "file"; file: File }
  | { type: "online"; snapshot: OnlineBackup };

function getErrorMessage(value: unknown, fallback: string): string {
  if (typeof value === "object" && value !== null && "error" in value) {
    const error = value.error;
    if (typeof error === "string") return error;
  }
  return fallback;
}

function isOnlineBackupPage(value: unknown): value is OnlineBackupPage {
  if (typeof value !== "object" || value === null || !("snapshots" in value) || !Array.isArray(value.snapshots)) {
    return false;
  }
  return (
    ("nextCursor" in value && (value.nextCursor === null || typeof value.nextCursor === "string")) &&
    value.snapshots.every(
      (snapshot) =>
        typeof snapshot === "object" &&
        snapshot !== null &&
        "id" in snapshot &&
        typeof snapshot.id === "string" &&
        "createdAt" in snapshot &&
        typeof snapshot.createdAt === "string" &&
        Number.isFinite(Date.parse(snapshot.createdAt)) &&
        "size" in snapshot &&
        typeof snapshot.size === "number" &&
        Number.isFinite(snapshot.size)
    )
  );
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function fetchSnapshotPage(cursor?: string, signal?: AbortSignal): Promise<OnlineBackupPage> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  const response = await fetch(`/api/backup/snapshots${query}`, { signal });
  const result: unknown = await response.json();
  if (!response.ok) {
    throw new Error(getErrorMessage(result, "Couldn't load online backups."));
  }
  if (!isOnlineBackupPage(result)) {
    throw new Error("The online backup list response was invalid.");
  }
  return result;
}

export function BackupRestorePanel() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [restoreSource, setRestoreSource] = useState<RestoreSource | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isCreatingOnlineBackup, setIsCreatingOnlineBackup] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isLoadingSnapshots, setIsLoadingSnapshots] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [snapshots, setSnapshots] = useState<OnlineBackup[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [expandedPreviewId, setExpandedPreviewId] = useState<string | null>(null);
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Record<string, OnlineBackupPreview>>({});

  const loadSnapshots = useCallback(async (cursor?: string, append = false) => {
    try {
      const result = await fetchSnapshotPage(cursor);
      setSnapshotError(null);
      setSnapshots((current) => (append ? [...current, ...result.snapshots] : result.snapshots));
      setNextCursor(result.nextCursor);
    } catch (error) {
      setSnapshotError(error instanceof Error ? error.message : "Couldn't load online backups.");
    } finally {
      setIsLoadingSnapshots(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetchSnapshotPage(undefined, controller.signal)
      .then((result) => {
        setSnapshots(result.snapshots);
        setNextCursor(result.nextCursor);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setSnapshotError(error instanceof Error ? error.message : "Couldn't load online backups.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingSnapshots(false);
      });
    return () => controller.abort();
  }, []);

  async function downloadBackup() {
    setIsDownloading(true);
    try {
      const response = await fetch("/api/backup");
      if (!response.ok) {
        const result: unknown = await response.json();
        throw new Error(getErrorMessage(result, "Couldn't export the backup."));
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `mediakit-backup-${todayKey()}.json`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Backup downloaded");
    } catch (error) {
      toast.error("Couldn't export the backup", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsDownloading(false);
    }
  }

  function selectBackup(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) {
      toast.error("Backup file is too large", { description: "Choose a JSON file no larger than 10 MB." });
      return;
    }
    setRestoreSource({ type: "file", file });
    setDialogOpen(true);
  }

  async function restoreBackup() {
    if (!restoreSource) return;
    setIsRestoring(true);
    try {
      const response = await fetch(
        restoreSource.type === "file"
          ? "/api/backup"
          : `/api/backup/snapshots/${encodeURIComponent(restoreSource.snapshot.id)}`,
        {
          method: "POST",
          ...(restoreSource.type === "file"
            ? {
                headers: { "Content-Type": "application/json" },
                body: await restoreSource.file.text(),
              }
            : {}),
        }
      );
      const result: unknown = await response.json();
      if (!response.ok) {
        throw new Error(getErrorMessage(result, "Couldn't restore the backup."));
      }

      setDialogOpen(false);
      setRestoreSource(null);
      toast.success("Backup restored");
      router.refresh();
    } catch (error) {
      toast.error("Couldn't restore the backup", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsRestoring(false);
    }
  }

  async function createOnlineBackup() {
    setIsCreatingOnlineBackup(true);
    try {
      const response = await fetch("/api/backup/snapshots", { method: "POST" });
      const result: unknown = await response.json();
      if (!response.ok) {
        throw new Error(getErrorMessage(result, "Couldn't create an online backup."));
      }
      if (
        typeof result !== "object" ||
        result === null ||
        !("snapshot" in result) ||
        !isOnlineBackupPage({ snapshots: [result.snapshot], nextCursor: null })
      ) {
        throw new Error("The online backup response was invalid.");
      }
      toast.success("Online backup saved");
      setIsLoadingSnapshots(true);
      await loadSnapshots();
    } catch (error) {
      toast.error("Couldn't create an online backup", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsCreatingOnlineBackup(false);
    }
  }

  async function toggleSnapshotPreview(snapshot: OnlineBackup, open: boolean) {
    setExpandedPreviewId(open ? snapshot.id : null);
    setPreviewError(null);
    if (!open || previews[snapshot.id]) return;

    setPreviewLoadingId(snapshot.id);
    try {
      const response = await fetch(`/api/backup/snapshots/${encodeURIComponent(snapshot.id)}`);
      const result: unknown = await response.json();
      if (!response.ok) {
        throw new Error(getErrorMessage(result, "Couldn't preview this backup."));
      }
      if (!isOnlineBackupPreview(result)) {
        throw new Error("The backup preview response was invalid.");
      }
      setPreviews((current) => ({ ...current, [snapshot.id]: result }));
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : "Couldn't preview this backup.");
    } finally {
      setPreviewLoadingId(null);
    }
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="mb-1 flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Download className="size-4" />
            </div>
            <CardTitle>Export a backup</CardTitle>
            <CardDescription>
              Download your workspace records as a versioned JSON file you can keep somewhere safe.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={downloadBackup} disabled={isDownloading}>
              <Download />
              {isDownloading ? "Preparing backup…" : "Download backup"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="mb-1 flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Upload className="size-4" />
            </div>
            <CardTitle>Restore a backup</CardTitle>
            <CardDescription>
              Choose a backup JSON file. Restore replaces all supported workspace records with the
              records in that file.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <input
              ref={fileInput}
              type="file"
              accept=".json,application/json"
              className="sr-only"
              aria-label="Choose a MediaKit backup JSON file"
              onChange={(event) => {
                selectBackup(event.currentTarget.files?.[0]);
                event.currentTarget.value = "";
              }}
            />
            <Button
              variant="outline"
              onClick={() => fileInput.current?.click()}
              disabled={isRestoring}
            >
              <Upload />
              Choose backup file
            </Button>
            {restoreSource?.type === "file" && (
              <p className="mt-2 break-all text-xs text-muted-foreground">
                Selected: {restoreSource.file.name}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1 flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Cloud className="size-4" />
            </div>
            <CardTitle>Online snapshots</CardTitle>
            <CardDescription>
              Encrypted copies stored in Vercel Blob. Only the server can decrypt them. The newest
              3 snapshots are kept; creating another removes the oldest.
            </CardDescription>
          </div>
          <Button onClick={createOnlineBackup} disabled={isCreatingOnlineBackup}>
            <Cloud />
            {isCreatingOnlineBackup ? "Saving snapshot…" : "Create online backup"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {snapshotError && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-xs text-destructive">{snapshotError}</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setIsLoadingSnapshots(true);
                  void loadSnapshots();
                }}
              >
                <RefreshCw />
                Try again
              </Button>
            </div>
          )}
          {isLoadingSnapshots && snapshots.length === 0 && (
            <p className="text-xs text-muted-foreground">Loading online snapshots…</p>
          )}
          {!isLoadingSnapshots && !snapshotError && snapshots.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No online snapshots yet. Create one to save a restore point.
            </p>
          )}
          {snapshots.map((snapshot) => {
            const preview = previews[snapshot.id];
            return (
              <Collapsible
                key={snapshot.id}
                open={expandedPreviewId === snapshot.id}
                onOpenChange={(open) => void toggleSnapshotPreview(snapshot, open)}
                className="rounded-md border border-border/70"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {formatTimestampIST(snapshot.createdAt, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })} IST
                    </p>
                    <p className="text-xs text-muted-foreground">{formatSize(snapshot.size)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <CollapsibleTrigger asChild>
                      <Button size="sm" variant="ghost">
                        <Eye />
                        {expandedPreviewId === snapshot.id ? "Hide preview" : "Preview"}
                        <ChevronDown
                          className={`transition-transform ${expandedPreviewId === snapshot.id ? "rotate-180" : ""}`}
                        />
                      </Button>
                    </CollapsibleTrigger>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isRestoring || isCreatingOnlineBackup}
                      onClick={() => {
                        setRestoreSource({ type: "online", snapshot });
                        setDialogOpen(true);
                      }}
                    >
                      <RotateCcw />
                      Restore this save
                    </Button>
                  </div>
                </div>
                <CollapsibleContent className="border-t border-border/70 px-3 py-3">
                  {previewLoadingId === snapshot.id && (
                    <p className="text-xs text-muted-foreground">Decrypting preview…</p>
                  )}
                  {previewError && expandedPreviewId === snapshot.id && (
                    <p role="alert" className="text-xs text-destructive">{previewError}</p>
                  )}
                  {preview && (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground">
                        Snapshot captured{" "}
                        {formatTimestampIST(preview.exportedAt, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })} IST
                      </p>
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                        {PREVIEW_COUNT_LABELS.map(([key, label]) => (
                          <div key={key}>
                            <dt className="text-xs text-muted-foreground">{label}</dt>
                            <dd className="text-sm font-medium">{preview.counts[key]}</dd>
                          </div>
                        ))}
                      </dl>
                      <div className="flex flex-wrap gap-2">
                        {PREVIEW_SAVED_LABELS.map(([key, label]) => (
                          <span
                            key={key}
                            className={`rounded-full border px-2 py-1 text-[0.65rem] ${preview.counts[key] ? "border-primary/30 bg-primary/5 text-foreground" : "border-border text-muted-foreground"}`}
                          >
                            {label}: {preview.counts[key] ? "saved" : "not saved"}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            );
          })}
          {nextCursor && (
            <div className="flex justify-center pt-1">
              <Button
                size="sm"
                variant="ghost"
                disabled={isLoadingSnapshots}
                onClick={() => {
                  setIsLoadingSnapshots(true);
                  void loadSnapshots(nextCursor, true);
                }}
              >
                {isLoadingSnapshots ? "Loading…" : "Load older snapshots"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardContent className="flex gap-3 py-4">
          <DatabaseBackup className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-medium">What the backup contains</p>
            <p className="text-xs text-muted-foreground">
              Brands, campaigns, invoices and defaults, calendar items, editor and affiliate records,
              media kit and links drafts and published versions, Trash, and the recent activity log.
              Passwords, integration credentials, and visitor analytics are not included. Uploaded
              files in external storage are not copied; their record links are retained.
            </p>
          </div>
        </CardContent>
      </Card>

      <AlertDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (isRestoring) return;
          setDialogOpen(open);
          if (!open) setRestoreSource(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace workspace records?</AlertDialogTitle>
            <AlertDialogDescription>
              {restoreSource?.type === "file"
                ? `Restoring “${restoreSource.file.name}” will replace all supported records currently in this workspace, including records and activity not present in the file. This cannot be undone.`
                : restoreSource?.type === "online"
                  ? `Restoring the online save from ${formatTimestampIST(restoreSource.snapshot.createdAt)} IST will replace all supported records currently in this workspace, including records and activity not present in that save. This cannot be undone.`
                : "Restoring this file will replace all supported records currently in this workspace. This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRestoring}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={!restoreSource || isRestoring}
              onClick={(event) => {
                event.preventDefault();
                void restoreBackup();
              }}
            >
              {isRestoring ? "Restoring…" : "Replace and restore"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
