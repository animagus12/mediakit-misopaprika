import { ChevronDown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { monthLabel } from "@/lib/earnings";
import { outflowCategoryLabel, type OutflowTotals } from "@/lib/expenses";
import { financialYearLabel } from "@/lib/financialYear";
import { formatMoney } from "@/lib/invoice";
import type { FlowPeriod, FlowTotals } from "@/lib/moneyBook";
import { payerLabel } from "@/lib/payers";
import { cn } from "@/lib/utils";

function tone(value: number): string {
  return value < 0 ? "text-destructive" : "";
}

function BridgeLine({
  label,
  hint,
  value,
  sign,
  className,
}: {
  label: string;
  hint?: string;
  value: number;
  sign?: "+" | "=";
  className?: string;
}) {
  return (
    <li className={cn("flex min-w-0 items-baseline justify-between gap-3", className)}>
      <span className="min-w-0">
        {sign && <span className="mr-1 text-muted-foreground">{sign}</span>}
        {label}
        {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
      </span>
      <span className={cn("shrink-0 tabular-nums", tone(value))}>{formatMoney(value)}</span>
    </li>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Collapsible>
      <CollapsibleTrigger className="group/section flex w-full items-center justify-between rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition pointer-coarse:min-h-11 hover:bg-muted">
        {title}
        <ChevronDown className="size-3.5 transition group-data-[state=open]/section:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2">{children}</CollapsibleContent>
    </Collapsible>
  );
}

/** The year's four headline figures, at the top of Payments. */
export function CashFlowStats({ totals }: { totals: FlowTotals }) {
  const stats = [
    { label: "Money in", value: totals.cashIn, hint: "Landed, after TDS and charges" },
    { label: "Money out", value: totals.cashOut, hint: "Editing and expenses" },
    { label: "Net cash flow", value: totals.netCash, hint: "In less out" },
    { label: "Profit", value: totals.profit, hint: "Also counts TDS and barter" },
  ];
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardHeader>
            <CardDescription>{stat.label}</CardDescription>
            <CardTitle className={cn("tabular-nums", tone(stat.value))}>{formatMoney(stat.value)}</CardTitle>
            <p className="text-xs text-muted-foreground">{stat.hint}</p>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

interface CashFlowDetailsProps {
  totals: FlowTotals;
  /** "FY 2026-27", or "All years". */
  period: string;
  /** Months of the year on show, or the years when every year is on show. */
  periods: FlowPeriod[];
  periodKind: "month" | "year";
  /** Who paid the span's costs: the business account or a partner. */
  payers: OutflowTotals["byPayer"];
  categories: OutflowTotals["byCategory"];
  owedToYou: number;
  owedToEditors: number;
}

/**
 * How the year's figures come about: cash in and out, and the profit behind
 * them. Cash flow is what moved through the business account; profit also
 * counts the TDS brands withheld (the creator's tax, already paid) and barter
 * received, so the two differ by exactly those and the card says so.
 */
export function CashFlowDetails({
  totals,
  period,
  periods,
  periodKind,
  payers,
  categories,
  owedToYou,
  owedToEditors,
}: CashFlowDetailsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Cash flow and profit · {period}</CardTitle>
        <CardDescription>
          Counted by the day money moved. Right now, {formatMoney(owedToYou)} is still owed to you and{" "}
          {formatMoney(owedToEditors)} to editors; neither is in the figures until it is paid.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="min-w-0 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">From cash to profit</p>
            <ul className="space-y-1.5 text-sm">
              <BridgeLine label="Net cash flow" value={totals.netCash} />
              <BridgeLine
                sign="+"
                label="TDS withheld by brands"
                hint="Tax paid for you; claim it back when you file"
                value={totals.tds}
              />
              <BridgeLine sign="+" label="Barter received" hint="Income in goods, not cash" value={totals.barter} />
              <BridgeLine
                sign="="
                label="Profit"
                value={totals.profit}
                className="border-t border-border pt-1.5 font-medium"
              />
            </ul>
          </div>

          <div className="min-w-0 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Who paid for costs</p>
            {payers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing spent yet.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {payers.map((entry) => (
                  <li key={entry.payer ?? "none"} className="flex min-w-0 items-baseline justify-between gap-3">
                    <span className="truncate">{entry.payer ? payerLabel(entry.payer) : "Not recorded"}</span>
                    <span className="shrink-0 tabular-nums">{formatMoney(entry.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[11px] text-muted-foreground">
              Money in always lands in the business account. What a partner paid personally is settled under
              Partners.
            </p>
          </div>
        </div>

        {periods.length > 0 && (
          <Section title={periodKind === "month" ? "Month by month" : "Year by year"}>
            <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <table className="w-full min-w-[26rem] text-xs tabular-nums">
                <thead>
                  <tr className="text-[0.7rem] text-muted-foreground uppercase">
                    <th className="py-1 pr-3 text-left font-medium">{periodKind === "month" ? "Month" : "Year"}</th>
                    <th className="py-1 pr-3 text-right font-medium">In</th>
                    <th className="py-1 pr-3 text-right font-medium">Out</th>
                    <th className="py-1 pr-3 text-right font-medium">Net cash</th>
                    <th className="py-1 text-right font-medium">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {periods.map((row) => (
                    <tr key={row.period} className="border-t border-border/60">
                      <td className="py-1.5 pr-3 text-left whitespace-nowrap">
                        {periodKind === "month" ? monthLabel(row.period) : financialYearLabel(Number(row.period))}
                      </td>
                      <td className="py-1.5 pr-3 text-right">{formatMoney(row.cashIn)}</td>
                      <td className="py-1.5 pr-3 text-right">{formatMoney(row.cashOut)}</td>
                      <td className={cn("py-1.5 pr-3 text-right", tone(row.netCash))}>{formatMoney(row.netCash)}</td>
                      <td className={cn("py-1.5 text-right", tone(row.profit))}>{formatMoney(row.profit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}

        {categories.length > 0 && (
          <Section title="Spending by category">
            <ul className="space-y-1 text-sm">
              {categories.map((entry) => (
                <li key={entry.category} className="flex min-w-0 justify-between gap-3">
                  <span className="truncate">{outflowCategoryLabel(entry.category)}</span>
                  <span className="shrink-0 tabular-nums">{formatMoney(entry.amount)}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </CardContent>
    </Card>
  );
}
