import type { Metadata } from "next";
import { listTrash } from "@/repositories/trash.writer.server";
import { TrashManager } from "@/components/trash/TrashManager";
import AppShell from "@/components/common/AppShell";

export const metadata: Metadata = {
  title: "Trash - @misopaprika",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function TrashPage() {
  const entries = await listTrash();
  return (
    <AppShell>
      <main className="mx-auto max-w-screen-lg px-4 py-10">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-heading text-lg font-semibold">Trash</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Deleted records stay here until you restore or permanently delete them.
            </p>
          </div>
        </div>
        <TrashManager entries={entries} />
      </main>
    </AppShell>
  );
}
