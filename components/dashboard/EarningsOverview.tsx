import { ChevronRight, ChevronDown, TrendingUp, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { EarningsChart } from "@/components/dashboard/EarningsChart";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/invoice";
import { monthLabel, currentMonthKey, monthsAgoKey, computeMonthTrend } from "@/lib/earnings";
import type { EarningsSummary, MonthlyEarnings } from "@/repositories/earnings";

type StatTone = "neutral" | "cash" | "barter" | "pending";

const TONE_STYLES: Record<StatTone, { card: string; value: string }> = {
  neutral: { card: "", value: "" },
  cash: { card: "bg-emerald-500/5 ring-emerald-500/15", value: "text-emerald-600 dark:text-emerald-400" },
  barter: { card: "bg-sky-500/5 ring-sky-500/15", value: "text-sky-600 dark:text-sky-400" },
  pending: { card: "bg-amber-500/5 ring-amber-500/15", value: "text-amber-600 dark:text-amber-400" },
};

const RECENT_MONTHS = 6;
const MONTH_GRID = "grid grid-cols-[auto_1fr_6rem_6rem_6rem_6rem] items-center gap-4";

function MonthRow({ month, highlight }: { month: MonthlyEarnings; highlight?: boolean }) {
  const summaryRow = (
    <div
      className={
        highlight
          ? `${MONTH_GRID} relative rounded-md bg-primary/8 py-2 pr-3 pl-4`
          : `${MONTH_GRID} rounded-md px-3 py-2`
      }
    >
      {highlight && <span className="absolute inset-y-1 left-0 w-1 rounded-full bg-primary" />}
      <ChevronRight className="size-3 shrink-0 text-muted-foreground transition group-data-[state=open]/month:rotate-90" />
      <span
        className={
          highlight
            ? "flex items-center gap-2 font-medium text-foreground"
            : "text-muted-foreground"
        }
      >
        {monthLabel(month.month)}
        {highlight && (
          <Badge variant="default" className="h-4 px-1.5 text-[0.6rem]">
            Current
          </Badge>
        )}
      </span>
      <span className="text-right tabular-nums">{formatMoney(month.paid)}</span>
      <span className="text-right tabular-nums">{formatMoney(month.barter)}</span>
      <span className="text-right tabular-nums text-muted-foreground">{formatMoney(month.pending)}</span>
      <span className={highlight ? "text-right font-semibold tabular-nums" : "text-right font-medium tabular-nums"}>
        {formatMoney(month.total)}
      </span>
    </div>
  );

  if (month.deals.length === 0) {
    return summaryRow;
  }

  return (
    <Collapsible>
      <CollapsibleTrigger className="group/month block w-full rounded-md text-left transition hover:bg-muted/50">
        {summaryRow}
      </CollapsibleTrigger>
      <CollapsibleContent className="mx-3 mt-1 mb-2 space-y-1.5 rounded-md bg-muted/30 py-2 pr-3 pl-4">
        {month.deals.map((deal, index) => (
          // Fixed-width deliverables/amount columns (not auto) so each deal
          // row — an independent grid, since rows vary in whether they even
          // have a deliverables badge — still lines up with its siblings.
          <div
            key={index}
            className="grid grid-cols-[auto_1fr_6.5rem_4.5rem] items-center gap-2.5 text-[0.7rem]"
          >
            <span className="size-1 shrink-0 rounded-full bg-muted-foreground/40" />
            <span className="truncate text-foreground/80">{deal.brand}</span>
            <span className="justify-self-end">
              {deal.deliverables && (
                <Badge variant="outline" className="h-4 px-1.5 text-[0.6rem] font-normal">
                  {deal.deliverables}
                </Badge>
              )}
            </span>
            <span className="text-right text-muted-foreground tabular-nums">{formatMoney(deal.amount)}</span>
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function EarningsOverview({ summary }: { summary: EarningsSummary }) {
  const stats: Array<{ label: string; value: number; tone: StatTone }> = [
    { label: "Lifetime earnings", value: summary.total, tone: "neutral" },
    { label: "Cash received", value: summary.paid, tone: "cash" },
    { label: "Barter value received", value: summary.barter, tone: "barter" },
    { label: "Pending payments", value: summary.pending, tone: "pending" },
  ];

  const trend = computeMonthTrend(summary.monthly);

  const cutoff = monthsAgoKey(RECENT_MONTHS);
  const recent = summary.monthly.filter((m) => m.month >= cutoff);
  const older = summary.monthly.filter((m) => m.month < cutoff);
  const thisMonth = currentMonthKey();

  return (
    <section className="mb-8 space-y-3">
      <h2 className="font-heading text-sm font-semibold">Earnings overview</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, tone }) => (
          <Card key={label} className={TONE_STYLES[tone].card}>
            <CardHeader>
              <CardDescription>{label}</CardDescription>
              <CardTitle className={cn("text-lg tabular-nums", TONE_STYLES[tone].value)}>
                {formatMoney(value)}
              </CardTitle>
              {label === "Lifetime earnings" && trend !== null && (
                <p
                  className={cn(
                    "flex items-center gap-1 text-[0.65rem] font-medium",
                    trend >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                  )}
                >
                  {trend >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                  {Math.abs(trend).toFixed(0)}% vs last month
                </p>
              )}
            </CardHeader>
          </Card>
        ))}
      </div>

      {summary.monthly.length > 0 && (
        <Card>
          <CardHeader className="gap-3">
            <div className="flex items-baseline justify-between">
              <CardDescription>Monthly breakdown</CardDescription>
            </div>
            <EarningsChart monthly={recent} />
            <div className="text-xs">
              <div className={`${MONTH_GRID} border-b border-foreground/10 px-3 pb-2 text-[0.7rem] font-medium tracking-wide text-muted-foreground/70 uppercase`}>
                <span />
                <span>Month</span>
                <span className="text-right">Cash</span>
                <span className="text-right">Barter</span>
                <span className="text-right">Pending</span>
                <span className="text-right">Total</span>
              </div>
              <div className="space-y-0.5 pt-1">
                {recent.map((m) => (
                  <MonthRow key={m.month} month={m} highlight={m.month === thisMonth} />
                ))}
              </div>
            </div>
          </CardHeader>

          {older.length > 0 && (
            <CardContent>
              <Collapsible>
                <CollapsibleTrigger className="group/trigger flex w-full items-center justify-between rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted">
                  Previous months ({older.length})
                  <ChevronDown className="size-3.5 transition group-data-[state=open]/trigger:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-0.5 text-xs">
                  {older.map((m) => (
                    <MonthRow key={m.month} month={m} />
                  ))}
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          )}
        </Card>
      )}
    </section>
  );
}
