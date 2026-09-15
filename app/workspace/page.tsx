import type { Metadata } from "next";
import AppShell from "@/components/common/AppShell";
import { EditorsSection } from "@/components/workspace/EditorsSection";
import { EditorTransactionsSection } from "@/components/workspace/EditorTransactionsSection";
import { NewEditorTransactionButton } from "@/components/workspace/NewEditorTransactionButton";
import { getEditorTransactions } from "@/repositories/editorTransactions.writer.server";
import { getEditors } from "@/repositories/editors.writer.server";
import type { EditorTransaction } from "@/repositories/editorTransactions";

export const metadata: Metadata = {
  title: "Editor workspace - @misopaprika",
  robots: { index: false, follow: false },
};

export default async function WorkspacePage() {
  const editors = await getEditors();

  let transactions: EditorTransaction[] = [];
  let error: string | null = null;
  try {
    transactions = await getEditorTransactions();
  } catch (err) {
    error = err instanceof Error ? err.message : "Something went wrong";
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-screen-lg xl:max-w-6xl 2xl:max-w-[1440px] space-y-6 px-4 py-10">
        <header className="flex items-start justify-between gap-3">
          <div className="space-y-0.5">
            <h1 className="font-heading text-lg font-semibold">Editor workspace</h1>
            <p className="text-xs text-muted-foreground">Video editing jobs and editor payouts.</p>
          </div>
          <NewEditorTransactionButton editors={editors} />
        </header>
        <EditorsSection editors={editors} transactions={transactions} />
        <EditorTransactionsSection transactions={transactions} editors={editors} error={error} />
      </div>
    </AppShell>
  );
}
