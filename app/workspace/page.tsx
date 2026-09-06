import type { Metadata } from "next";
import AppShell from "@/components/common/AppShell";
import { EditorsSection } from "@/components/workspace/EditorsSection";
import { EditorTransactionsSection } from "@/components/workspace/EditorTransactionsSection";
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
      <div className="mx-auto max-w-screen-lg xl:max-w-6xl 2xl:max-w-[1440px] space-y-8 px-4 py-10">
        <EditorsSection editors={editors} transactions={transactions} />
        <EditorTransactionsSection transactions={transactions} editors={editors} error={error} />
      </div>
    </AppShell>
  );
}
