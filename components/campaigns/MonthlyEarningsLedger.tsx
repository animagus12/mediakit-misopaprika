import { ChevronRight, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { formatMoney } from "@/lib/invoice";
import { monthLabel, currentMonthKey, monthsAgoKey } from "@/lib/earnings";
import type { MonthlyEarnings } from "@/repositories/earnings";

// The month-by-month record of what every deal brought in, expandable to the
// individual deals. It lives here rather than on the dashboard because it is
// a ledger: something you look a figure up in, not something you glance at.
// The dashboard keeps the chart and the trend.

const RECENT_MONTHS = 6;

// The commission column is dropped entirely when the book has none, rather
// than standing empty: this table already scrolls sideways on a phone, and a
// column of zeroes would cost that scroll another 4.5rem to say nothing.
function monthGrid(showCommission: boolean): string {
  return showCommission
    ? "grid grid-cols-[auto_1fr_4.5rem_4.5rem_4.5rem_4.5rem_4.5rem] items-center gap-2 sm:gap-4 min-w-[34.5rem]"
    : "grid grid-cols-[auto_1fr_4.5rem_4.5rem_4.5rem_4.5rem] items-center gap-2 sm:gap-4 min-w-[30rem]";
}

function MonthRow({
  month,
  highlight,
  showCommission,
}: {
  month: MonthlyEarnings;
  highlight?: boolean;
  showCommission: boolean;
}) {
  const MONTH_GRID = monthGrid(showCommission);
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
      {showCommission && (
        <span className="text-right tabular-nums text-violet-600 dark:text-violet-400">
          {formatMoney(month.commission)}
        </span>
      )}
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
      <CollapsibleTrigger className="group/month block w-full rounded-md text-left transition pointer-coarse:min-h-11 hover:bg-muted/50">
        {summaryRow}
      </CollapsibleTrigger>
      <CollapsibleContent className="mx-3 mt-1 mb-2 space-y-1.5 rounded-md bg-muted/30 py-2 pr-3 pl-4">
        {month.deals.map((deal, index) => (
          // Fixed-width deliverables/amount columns (not auto) so each deal
          // row: an independent grid, since rows vary in whether they even
          // have a deliverables badge: still lines up with its siblings.
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

export function MonthlyEarningsLedger({ monthly }: { monthly: MonthlyEarnings[] }) {
  if (monthly.length === 0) return null;

  const cutoff = monthsAgoKey(RECENT_MONTHS);
  const recent = monthly.filter((m) => m.month >= cutoff);
  const older = monthly.filter((m) => m.month < cutoff);
  const thisMonth = currentMonthKey();
  const showCommission = monthly.some((m) => m.commission > 0);
  const MONTH_GRID = monthGrid(showCommission);

  return (
    <Card>
      <CardHeader className="gap-3">
        <CardDescription>Monthly breakdown</CardDescription>
        <div className="-mx-4 overflow-x-auto px-4 text-xs sm:mx-0 sm:px-0">
          <div className={`${MONTH_GRID} border-b border-foreground/10 px-3 pb-2 text-[0.7rem] font-medium tracking-wide text-muted-foreground/70 uppercase`}>
            <span />
            <span>Month</span>
            <span className="text-right">Cash</span>
            <span className="text-right">Barter</span>
            {showCommission && <span className="text-right">Commission</span>}
            <span className="text-right">Pending</span>
            <span className="text-right">Received</span>
          </div>
          <div className="space-y-0.5 pt-1">
            {recent.map((m) => (
              <MonthRow
                key={m.month}
                month={m}
                highlight={m.month === thisMonth}
                showCommission={showCommission}
              />
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
            <CollapsibleContent className="-mx-4 mt-2 overflow-x-auto px-4 text-xs sm:mx-0 sm:px-0">
              <div className="space-y-0.5">
                {older.map((m) => (
                  <MonthRow key={m.month} month={m} showCommission={showCommission} />
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      )}
    </Card>
  );
}
