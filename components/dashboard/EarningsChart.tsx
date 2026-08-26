import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/invoice";
import { monthLabel, currentMonthKey } from "@/lib/earnings";
import type { MonthlyEarnings } from "@/repositories/earnings";

const CHART_HEIGHT = 112;

// Cash/barter/pending colors match the stat tiles in EarningsOverview so the
// same category reads as the same hue everywhere in the dashboard. Light
// shades pass the categorical CVD/contrast checks with the tooltip+legend as
// the required relief channel; dark shades are a step darker to stay inside
// the OKLCH lightness band on a dark surface (both validated via
// scripts/validate_palette.js from the dataviz skill).
const SERIES = [
  { key: "paid", label: "Cash", swatch: "bg-emerald-500 dark:bg-emerald-600" },
  { key: "barter", label: "Barter", swatch: "bg-sky-500 dark:bg-sky-600" },
  { key: "pending", label: "Pending", swatch: "bg-amber-500 dark:bg-amber-600" },
] as const;

function EarningsBar({
  month,
  isCurrent,
  maxValue,
}: {
  month: MonthlyEarnings;
  isCurrent: boolean;
  maxValue: number;
}) {
  const grandTotal = month.paid + month.barter + month.pending;

  let topVisible = -1;
  SERIES.forEach((s, i) => {
    if (month[s.key] > 0) topVisible = i;
  });

  return (
    <div
      tabIndex={0}
      className={cn(
        "group/bar relative flex flex-1 flex-col items-center gap-1.5 rounded-md px-1 pt-1 outline-none",
        "hover:bg-muted/50 focus-visible:bg-muted/50",
        isCurrent && "bg-primary/5"
      )}
    >
      {/* Below the column, not above: the chart sits inside a Card, which
          clips overflow, so a tooltip popping upward gets cut off near the
          top of the card. There's ample clearance below (the breakdown
          table), so the tooltip drops there instead. */}
      <div
        role="tooltip"
        className="pointer-events-none absolute top-full left-1/2 z-10 mt-2 w-36 -translate-x-1/2 rounded-md border border-border bg-popover p-2.5 text-popover-foreground opacity-0 shadow-md transition-opacity group-hover/bar:opacity-100 group-focus-visible/bar:opacity-100"
      >
        <p className="mb-1.5 text-[0.65rem] font-medium text-muted-foreground">{monthLabel(month.month)}</p>
        <div className="space-y-1">
          {SERIES.map((s) => (
            <div key={s.key} className="flex items-center justify-between gap-2 text-[0.7rem]">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className={cn("h-0.5 w-2.5 shrink-0 rounded-full", s.swatch)} />
                {s.label}
              </span>
              <span className="font-medium tabular-nums">{formatMoney(month[s.key])}</span>
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex items-center justify-between border-t border-border pt-1.5 text-[0.7rem] font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{formatMoney(grandTotal)}</span>
        </div>
      </div>

      <div
        className="flex w-6 flex-col-reverse gap-[2px] border-b border-border/60"
        style={{ height: CHART_HEIGHT }}
      >
        {SERIES.map((s, i) => {
          const value = month[s.key];
          if (value <= 0) return null;
          const heightPct = maxValue > 0 ? (value / maxValue) * 100 : 0;
          return (
            <div
              key={s.key}
              className={cn(s.swatch, i === topVisible && "rounded-t-[4px]")}
              style={{ height: `${heightPct}%` }}
            />
          );
        })}
      </div>

      <span className={cn("text-[0.65rem] font-medium text-muted-foreground", isCurrent && "text-foreground")}>
        {monthLabel(month.month).split(" ")[0]}
      </span>
    </div>
  );
}

export function EarningsChart({ monthly }: { monthly: MonthlyEarnings[] }) {
  if (monthly.length === 0) return null;

  // `monthly` is newest-first (matching the table below); a trend chart
  // reads oldest-to-newest left to right.
  const ascending = [...monthly].reverse();
  const maxValue = Math.max(...ascending.map((m) => m.paid + m.barter + m.pending), 1);
  const thisMonth = currentMonthKey();

  return (
    <div className="space-y-2.5">
      <div className="flex items-start gap-1">
        {ascending.map((month) => (
          <EarningsBar key={month.month} month={month} isCurrent={month.month === thisMonth} maxValue={maxValue} />
        ))}
      </div>
      <div className="flex items-center gap-4">
        {SERIES.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5 text-[0.7rem] text-muted-foreground">
            <span className={cn("size-2 rounded-sm", s.swatch)} />
            {s.label}
          </div>
        ))}
      </div>
    </div>
  );
}
