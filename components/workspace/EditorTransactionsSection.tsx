import { Card, CardContent } from "@/components/ui/card";
import { StatTile } from "@/components/dashboard/StatTile";
import type { EditorTransaction } from "@/repositories/editorTransactions";
import type { Editor } from "@/repositories/editors";
import { computeEditorPayouts, computeEditorTransactionStats } from "@/lib/editorTransactions";
import { formatMoney } from "@/lib/invoice";
import { EditorTransactionsTable } from "./EditorTransactionsTable";

interface EditorTransactionsSectionProps {
  transactions: EditorTransaction[];
  editors: Editor[];
  error?: string | null;
}

export function EditorTransactionsSection({ transactions, editors, error }: EditorTransactionsSectionProps) {
  if (error) {
    return (
      <section aria-labelledby="transactions-heading" className="space-y-3">
        <SectionHeader />
        <Card>
          <CardContent className="py-6 text-xs text-muted-foreground">
            Couldn&apos;t load editor transactions: {error}
          </CardContent>
        </Card>
      </section>
    );
  }

  const stats = computeEditorTransactionStats(transactions);
  // Same labels and tones as the dashboard's Money in and out row, so a
  // figure reads the same wherever it shows up.
  const payouts = computeEditorPayouts(transactions);

  return (
    <section aria-labelledby="transactions-heading" className="space-y-3">
      <SectionHeader count={stats.count} />

      {stats.count > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            label="Owed to editors"
            value={formatMoney(payouts.pending)}
            hint={payouts.pending > 0 ? "not yet paid out" : null}
            tone="out"
          />
          <StatTile label="Paid to editors" value={formatMoney(payouts.paid)} />
          <StatTile
            label="In progress"
            value={stats.inProgressCount}
            hint={`of ${stats.count} job${stats.count === 1 ? "" : "s"}`}
            tone={stats.inProgressCount > 0 ? "pending" : "neutral"}
          />
          <StatTile
            label="Avg. turnaround"
            value={stats.etaSample > 0 ? `${stats.avgEtaDays}d` : "-"}
            hint={
              stats.etaSample > 0
                ? `across ${stats.etaSample} delivered job${stats.etaSample === 1 ? "" : "s"}`
                : null
            }
          />
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

// "New transaction" sits in the page header instead: it's the page's main
// action, the same call the dashboard makes with QuickActions.
function SectionHeader({ count }: { count?: number }) {
  return (
    <h2 id="transactions-heading" className="font-heading text-sm font-semibold">
      Transactions
      {count != null && count > 0 && (
        <>
          {" "}
          <span className="ml-1 font-normal text-muted-foreground tabular-nums">{count}</span>
        </>
      )}
    </h2>
  );
}
