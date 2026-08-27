import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { computeInvoiceStats, formatMoney } from "@/lib/invoice";
import { cn } from "@/lib/utils";
import type { Invoice } from "@/repositories/invoices";
import { InvoicesTable } from "./InvoicesTable";

// Same tone system as the workspace's transaction stat cards, so money/count
// tiles read consistently across the dashboard.
const STAT_TONES = {
  neutral: { card: "", value: "" },
  cash: { card: "bg-emerald-500/5 ring-emerald-500/15", value: "text-emerald-600 dark:text-emerald-400" },
  warn: { card: "bg-amber-500/5 ring-amber-500/15", value: "text-amber-600 dark:text-amber-400" },
  info: { card: "bg-sky-500/5 ring-sky-500/15", value: "text-sky-600 dark:text-sky-400" },
} as const;

interface InvoiceListSectionProps {
  invoices: Invoice[];
  error?: string | null;
}

export function InvoiceListSection({ invoices, error }: InvoiceListSectionProps) {
  const stats = computeInvoiceStats(invoices);

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <h1 className="font-heading text-lg font-semibold">Invoices</h1>
          <p className="text-xs text-muted-foreground">
            Create, revisit, and edit invoices for brand collaborations.
          </p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/invoices/new">
            <Plus className="size-3.5" />
            New invoice
          </Link>
        </Button>
      </div>

      {error ? (
        <Card>
          <CardContent className="py-6 text-xs text-muted-foreground">
            Couldn&apos;t load saved invoices — {error}
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
            <Card className={STAT_TONES.neutral.card}>
              <CardHeader>
                <CardDescription>Invoices</CardDescription>
                <CardTitle className={cn("text-lg tabular-nums", STAT_TONES.neutral.value)}>
                  {stats.count}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className={STAT_TONES.cash.card}>
              <CardHeader>
                <CardDescription>Total billed</CardDescription>
                <CardTitle className={cn("text-lg tabular-nums", STAT_TONES.cash.value)}>
                  {formatMoney(stats.totalBilled)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className={STAT_TONES.warn.card}>
              <CardHeader>
                <CardDescription>Outstanding</CardDescription>
                <CardTitle className={cn("text-lg tabular-nums", STAT_TONES.warn.value)}>
                  {formatMoney(stats.totalOutstanding)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className={STAT_TONES.info.card}>
              <CardHeader>
                <CardDescription>Overdue</CardDescription>
                <CardTitle className={cn("text-lg tabular-nums", STAT_TONES.info.value)}>
                  {stats.overdueCount}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          <InvoicesTable invoices={invoices} />
        </>
      )}
    </section>
  );
}
