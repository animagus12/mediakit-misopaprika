import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { computeInvoiceStats, formatMoney, type InvoiceFilter } from "@/lib/invoice";
import { cn } from "@/lib/utils";
import type { Invoice } from "@/repositories/invoices";
import { InvoicesTable } from "./InvoicesTable";

// Same tone system as the workspace's transaction stat cards, so money/count
// tiles read consistently across the dashboard.
const STAT_TONES = {
  neutral: { card: "", value: "" },
  cash: { card: "bg-emerald-500/5 ring-emerald-500/15", value: "text-emerald-600 dark:text-emerald-400" },
  warn: { card: "bg-amber-500/5 ring-amber-500/15", value: "text-amber-600 dark:text-amber-400" },
  danger: { card: "bg-red-500/5 ring-red-500/15", value: "text-red-600 dark:text-red-400" },
} as const;

interface InvoiceListSectionProps {
  invoices: Invoice[];
  error?: string | null;
}

export function InvoiceListSection({ invoices, error }: InvoiceListSectionProps) {
  const stats = computeInvoiceStats(invoices);

  // Each tile is a shortcut into the matching table view (?tab=…).
  const statCards: {
    label: string;
    value: string | number;
    tone: (typeof STAT_TONES)[keyof typeof STAT_TONES];
    tab: InvoiceFilter;
  }[] = [
    { label: "Invoices", value: stats.count, tone: STAT_TONES.neutral, tab: "all" },
    { label: "Total billed", value: formatMoney(stats.totalBilled), tone: STAT_TONES.cash, tab: "all" },
    { label: "Outstanding", value: formatMoney(stats.totalOutstanding), tone: STAT_TONES.warn, tab: "unpaid" },
    {
      label: "Overdue",
      value: stats.overdueCount,
      tone: stats.overdueCount > 0 ? STAT_TONES.danger : STAT_TONES.neutral,
      tab: "overdue",
    },
  ];

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <h1 className="font-heading text-lg font-semibold">Invoices</h1>
          <p className="text-xs text-muted-foreground">
            Create, revisit, and edit invoices for brand collaborations.
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/invoices/new">
            <Plus className="size-3.5" />
            New invoice
          </Link>
        </Button>
      </div>

      {error ? (
        <Card>
          <CardContent className="py-6 text-xs text-muted-foreground">
            Couldn&apos;t load saved invoices: {error}
          </CardContent>
        </Card>
      ) : invoices.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-3 py-6 text-xs text-muted-foreground">
            No invoices yet.
            <Button asChild size="sm">
              <Link href="/invoices/new">
                <Plus className="size-3.5" />
                Create your first invoice
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {statCards.map((card) => (
              <Link
                key={card.label}
                href={card.tab === "all" ? "/invoices" : `/invoices?tab=${card.tab}`}
                className="rounded-lg outline-offset-2 transition hover:ring-2 hover:ring-ring/30 focus-visible:outline-2 focus-visible:outline-ring"
              >
                <Card className={cn("h-full", card.tone.card)}>
                  <CardHeader>
                    <CardDescription>{card.label}</CardDescription>
                    <CardTitle className={cn("text-lg tabular-nums", card.tone.value)}>
                      {card.value}
                    </CardTitle>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>

          <Suspense fallback={<div className="h-64 rounded-md border border-border" />}>
            <InvoicesTable invoices={invoices} />
          </Suspense>
        </>
      )}
    </section>
  );
}
