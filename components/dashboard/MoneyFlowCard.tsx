import { cn } from "@/lib/utils";
import { formatMoney, type InvoiceStats, type InvoiceMarginTotals } from "@/lib/invoice";
import type { EditorPayoutSummary } from "@/lib/editorTransactions";
import { StatTile, type StatTone } from "./StatTile";

interface Tile {
  label: string;
  value: string;
  hint: string | null;
  href: string;
  tone: StatTone;
}

interface MoneyFlowCardProps {
  invoices: InvoiceStats;
  payouts: EditorPayoutSummary;
  margins: InvoiceMarginTotals;
  className?: string;
}

/**
 * What is owed to the creator and what the creator owes, side by side.
 *
 * The dashboard reported gross income and no costs at all, which makes
 * "earned" read as "kept" when a share of every edited video was always going
 * out again. It also flagged overdue invoices one row at a time without ever
 * saying what they came to: a list of six is a to-do list, and the sum is the
 * number that decides whether this month is a problem.
 *
 * All four are running totals to date, not this month, because an editor
 * payout carries the day the video was assigned and delivered and never the
 * day it was settled: these are cash figures, and there is no honest way to
 * bucket a cash figure by month out of dates that do not record when the cash
 * moved. The margin line under the earnings chart buckets the same
 * transactions by delivery date, which is a different and defensible claim
 * ("what this month's output cost to make") and is labelled as one.
 */
export function MoneyFlowCard({ invoices, payouts, margins, className }: MoneyFlowCardProps) {
  const tiles: Tile[] = [
    {
      label: "Outstanding on invoices",
      value: formatMoney(invoices.totalOutstanding),
      hint:
        invoices.overdueCount > 0
          ? `${invoices.overdueCount} overdue`
          : invoices.totalOutstanding > 0
            ? "none overdue yet"
            : null,
      href: "/invoices",
      tone: "owed",
    },
    {
      label: "Owed to editors",
      value: formatMoney(payouts.pending),
      hint: payouts.pending > 0 ? "not yet paid out" : null,
      href: "/workspace",
      tone: "out",
    },
    {
      label: "Paid to editors",
      value: formatMoney(payouts.paid),
      hint: null,
      href: "/workspace",
      tone: "neutral",
    },
  ];

  // Only once an invoice actually bills for an edit. A permanent "-" would be
  // a quarter of this row spent saying nothing, the same reason a brand's
  // renewals tile and the campaigns table's usage column are conditional.
  if (margins.invoices > 0) {
    tiles.push({
      label: "Margin after editing",
      value: formatMoney(margins.margin),
      // Named rather than implied: this covers only the invoices with an
      // editing job linked to them, and reading it as the whole book's margin
      // would count every unlinked invoice as costing nothing.
      hint: `on ${margins.invoices} invoice${margins.invoices === 1 ? "" : "s"} with a linked edit`,
      href: "/invoices",
      tone: "cash",
    });
  }

  return (
    <section className={cn("space-y-3", className)}>
      <div className="space-y-0.5">
        <h2 className="font-heading text-sm font-semibold">Money in and out</h2>
        <p className="text-xs text-muted-foreground">To date</p>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((tile) => (
          <StatTile key={tile.label} {...tile} />
        ))}
      </div>
    </section>
  );
}
