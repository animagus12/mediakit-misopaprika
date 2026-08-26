import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { EditorTransaction } from "@/repositories/editorTransactions";
import type { Editor } from "@/repositories/editors";
import { computeEditorTransactionStats } from "@/lib/editorTransactions";
import { formatMoney } from "@/lib/invoice";
import { cn } from "@/lib/utils";
import { EditorTransactionsTable } from "./EditorTransactionsTable";
import { NewEditorTransactionButton } from "./NewEditorTransactionButton";

// Same tone system as the earnings overview's stat cards, so money/count
// tiles read consistently across the dashboard.
const STAT_TONES = {
  neutral: { card: "", value: "" },
  cash: { card: "bg-emerald-500/5 ring-emerald-500/15", value: "text-emerald-600 dark:text-emerald-400" },
  info: { card: "bg-sky-500/5 ring-sky-500/15", value: "text-sky-600 dark:text-sky-400" },
  time: { card: "bg-amber-500/5 ring-amber-500/15", value: "text-amber-600 dark:text-amber-400" },
} as const;

interface EditorTransactionsSectionProps {
  transactions: EditorTransaction[];
  editors: Editor[];
  error?: string | null;
}

export function EditorTransactionsSection({ transactions, editors, error }: EditorTransactionsSectionProps) {
  if (error) {
    return (
      <section className="space-y-4">
        <SectionHeader editors={editors} />
        <Card>
          <CardContent className="py-6 text-xs text-muted-foreground">
            Couldn&apos;t load editor transactions — {error}
          </CardContent>
        </Card>
      </section>
    );
  }

  const stats = computeEditorTransactionStats(transactions);

  return (
    <section className="space-y-4">
      <SectionHeader editors={editors} />

      {stats.count > 0 && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Card className={STAT_TONES.neutral.card}>
            <CardHeader>
              <CardDescription>Transactions</CardDescription>
              <CardTitle className={cn("text-lg tabular-nums", STAT_TONES.neutral.value)}>
                {stats.count}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className={STAT_TONES.cash.card}>
            <CardHeader>
              <CardDescription>Total paid out</CardDescription>
              <CardTitle className={cn("text-lg tabular-nums", STAT_TONES.cash.value)}>
                {formatMoney(stats.totalAmount)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className={STAT_TONES.info.card}>
            <CardHeader>
              <CardDescription>Editors</CardDescription>
              <CardTitle className={cn("text-lg tabular-nums", STAT_TONES.info.value)}>
                {stats.editorCount}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className={STAT_TONES.time.card}>
            <CardHeader>
              <CardDescription>Avg. turnaround</CardDescription>
              <CardTitle className={cn("text-lg tabular-nums", STAT_TONES.time.value)}>
                {stats.avgEtaDays}d
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {transactions.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-xs text-muted-foreground">
            No editor transactions yet.
          </CardContent>
        </Card>
      ) : (
        <EditorTransactionsTable transactions={transactions} editors={editors} />
      )}
    </section>
  );
}

function SectionHeader({ editors }: { editors: Editor[] }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="space-y-1">
        <h1 className="font-heading text-lg font-semibold">Editor workspace</h1>
        <p className="text-xs text-muted-foreground">
          Video editing transactions and editor payouts.
        </p>
      </div>
      <NewEditorTransactionButton editors={editors} />
    </div>
  );
}
