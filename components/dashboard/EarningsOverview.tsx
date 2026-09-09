import { TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardDescription, CardHeader } from "@/components/ui/card";
import { EarningsChart } from "@/components/dashboard/EarningsChart";
import { MarginTrend } from "@/components/dashboard/MarginTrend";
import { StatTile, type StatTone } from "@/components/dashboard/StatTile";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/invoice";
import {
  monthLabel,
  currentMonthKey,
  monthsAgoKey,
  computeMonthTrend,
  type MonthMargin,
} from "@/lib/earnings";
import type { MonthForecast } from "@/lib/cashTiming";
import type { EarningsSummary, MonthlyEarnings } from "@/repositories/earnings";

const RECENT_MONTHS = 6;

const EMPTY_MONTH: Omit<MonthlyEarnings, "month"> = {
  total: 0,
  paid: 0,
  barter: 0,
  commission: 0,
  pending: 0,
  deals: [],
};

/**
 * The dashboard's earnings block: this month's figures, the six-month shape,
 * and the month-over-month trend.
 *
 * Deliberately current-period rather than lifetime. The lifetime totals and
 * the month-by-month ledger both live on /campaigns, which is where a figure
 * is looked up; a dashboard answers "how is it going right now", and a number
 * that only moves once a quarter cannot answer that.
 */
export function EarningsOverview({
  summary,
  forecast,
  margins,
}: {
  summary: EarningsSummary;
  /** The month in progress, finished out with what is contractually due. */
  forecast: MonthForecast;
  /** Cash net of editing, newest first, filtered here to the charted window. */
  margins: MonthMargin[];
}) {
  const thisMonthKey = currentMonthKey();
  const thisMonth = summary.monthly.find((m) => m.month === thisMonthKey) ?? EMPTY_MONTH;

  // Commission earns a tile only in a month that had some. It is a fifth
  // figure on a row built for four, and a permanent zero would cost every
  // other tile a quarter of its width to say nothing.
  const stats: Array<{ label: string; value: number; tone: StatTone }> = [
    { label: "Received", value: thisMonth.total, tone: "neutral" },
    { label: "Cash", value: thisMonth.paid, tone: "cash" },
    { label: "Barter value", value: thisMonth.barter, tone: "barter" },
    ...(thisMonth.commission > 0
      ? [{ label: "Commission", value: thisMonth.commission, tone: "commission" as StatTone }]
      : []),
    { label: "Pending", value: thisMonth.pending, tone: "pending" as StatTone },
  ];

  const trend = computeMonthTrend(summary.monthly);
  // -1 because the window includes the month in progress: monthsAgoKey(6)
  // would put seven columns under a heading that promises six.
  const cutoff = monthsAgoKey(RECENT_MONTHS - 1);
  const recent = summary.monthly.filter((m) => m.month >= cutoff);
  const recentMargins = margins.filter((m) => m.month >= cutoff);

  return (
    <section className="mb-8 space-y-3">
      <div className="space-y-0.5">
        <h2 className="font-heading text-sm font-semibold">Earnings</h2>
        {/* The tiles below are one month wide, so the month is named rather
            than left to be inferred from the word "received".
            The forecast is on this line rather than on a fifth tile: the tiles
            are all actuals, and a projection standing among them in the same
            weight would be read as one. Shown only when something is actually
            booked to land before the month is out, since "forecast: the same
            number again" is a claim about the future dressed up as a figure. */}
        <p className="text-xs text-muted-foreground">
          {monthLabel(thisMonthKey)} so far
          {forecast.expected > 0 && (
            <>
              {" · "}
              <span className="text-foreground">{formatMoney(forecast.forecast)}</span> forecast,
              with {formatMoney(forecast.expected)} due across {forecast.sources} payment
              {forecast.sources === 1 ? "" : "s"} before month end
            </>
          )}
        </p>
      </div>

      <div className={cn("grid grid-cols-2 gap-4", stats.length === 5 ? "lg:grid-cols-5" : "lg:grid-cols-4")}>
        {stats.map(({ label, value, tone }) => (
          <StatTile key={label} label={label} value={formatMoney(value)} tone={tone} />
        ))}
      </div>

      {recent.length > 0 && (
        <Card>
          <CardHeader className="gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <CardDescription>Last {RECENT_MONTHS} months</CardDescription>
              {/* The trend sits with the chart, not on a tile: it compares two
                  complete months, and the tiles are about the one in progress. */}
              {trend !== null && (
                <p
                  className={cn(
                    "flex items-center gap-1 text-[0.65rem] font-medium",
                    trend.percent >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                  )}
                >
                  {trend.percent >= 0 ? (
                    <TrendingUp className="size-3" />
                  ) : (
                    <TrendingDown className="size-3" />
                  )}
                  {Math.abs(trend.percent).toFixed(0)}%
                  <span className="font-normal text-muted-foreground">{trend.label}</span>
                </p>
              )}
            </div>
            <EarningsChart monthly={recent} />
            {/* A sibling of the chart, not a child of it: both are block
                children of this header, so the line spans exactly the width
                the bars do and its points land on their columns. */}
            <MarginTrend series={[...recentMargins].reverse()} />
          </CardHeader>
        </Card>
      )}
    </section>
  );
}
