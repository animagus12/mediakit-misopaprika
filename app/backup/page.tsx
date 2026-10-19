import type { Metadata } from "next";
import AppShell from "@/components/common/AppShell";
import { BackupRestorePanel } from "@/components/backup/BackupRestorePanel";

export const metadata: Metadata = {
  title: "Backup & restore - @misopaprika",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function BackupPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="mb-6">
          <h1 className="font-heading text-lg font-semibold">Backup &amp; restore</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Export a copy of your workspace records or restore them from a backup.
          </p>
        </div>
        <BackupRestorePanel />
      </div>
    </AppShell>
  );
}
