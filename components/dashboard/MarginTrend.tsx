import { formatMoney } from "@/lib/invoice";
import { monthLabel, type MonthMargin } from "@/lib/earnings";
import { cn } from "@/lib/utils";

// The plot's vertical band, in the same 0-100 space as the viewBox. Padded
// top and bottom so a peak or a trough is a point on a line rather than a
// value clipped by the edge of the box.
const TOP = 10;
const BOTTOM = 90;
const HEIGHT_PX = 44;

interface MarginTrendProps {
  /** Oldest first, the same months and the same order the bars are drawn in. */
  series: MonthMargin[];
  className?: string;
}

/**
 * Cash received each month with the editing bill taken out, drawn under the
 * bars it is derived from.
 *
 * The chart above stacks what came in. This is what was kept, which is a
 * different line and on some months a much lower one: the dashboard reported
 * gross income and, in a separate row, running payout totals, so nothing on
 * the page ever put the two in the same picture.
 *
 * A line rather than a fourth bar series, deliberately. The bars answer "how
 * big was the month"; this answers "how much of it survived", which is a rate,
 * and stacking a cost onto a chart of income would read as more income.
 *
 * Column centres are at (i + 0.5) / n of the width, which is exact only
 * because the bar row tiles its columns edge to edge and spaces the bars with
 * padding inside each one rather than with a gap between them. Changing that
 * back to a gap silently shifts this line off the bars it belongs to.
 */
export function MarginTrend({ series, className }: MarginTrendProps) {
  // Two points make a line; one makes a dot that implies a trend it cannot
  // show. And with no editing recorded anywhere in the window this is the cash
  // bars redrawn as a line, which is a second way of saying what the chart
  // above already says.
  if (series.length < 2 || !series.some((month) => month.editorCost > 0)) return null;

  const values = series.map((month) => month.margin);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min;

  const x = (index: number) => ((index + 0.5) / series.length) * 100;
  // A flat series sits on the midline rather than dividing by a zero span.
  const y = (value: number) =>
    span === 0 ? (TOP + BOTTOM) / 2 : BOTTOM - ((value - min) / span) * (BOTTOM - TOP);

  const points = series.map((month, index) => `${x(index)},${y(month.margin)}`).join(" ");
  const latest = series[series.length - 1];

  return (
    <div className={cn("space-y-1.5 border-t border-border/60 pt-3", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[0.7rem] text-muted-foreground">Cash kept, net of editing</p>
        <p className="text-[0.7rem] tabular-nums">
          <span
            className={cn(
              "font-medium",
              latest.margin < 0 ? "text-destructive" : "text-foreground"
            )}
          >
            {formatMoney(latest.margin)}
          </span>
          <span className="ml-1.5 font-normal text-muted-foreground">
            in {monthLabel(latest.month).split(" ")[0]}
            {latest.marginPercent !== null && latest.editorCost > 0
              ? ` · ${Math.round(latest.marginPercent)}% of cash`
              : ""}
          </span>
        </p>
      </div>

      <div className="relative" style={{ height: HEIGHT_PX }}>
        <svg
          className="absolute inset-0 size-full text-foreground/45"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          role="img"
          aria-label={series
            .map((month) => `${monthLabel(month.month)}: ${formatMoney(month.margin)} kept`)
            .join(", ")}
        >
          {/* Only drawn once a month has actually gone negative: a zero rule
              under a series that never crosses it is a line with nothing to
              say. */}
          {min < 0 && (
            <line
              x1="0"
              x2="100"
              y1={y(0)}
              y2={y(0)}
              className="text-border"
              stroke="currentColor"
              strokeWidth={1}
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {/* preserveAspectRatio="none" stretches the box to the row width, so
              the stroke has to opt out of scaling or it thins to nothing. */}
          <polyline
            points={points}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {/* The end of the line, marked outside the SVG: a circle inside a
            stretched viewBox draws as an ellipse. */}
        <span
          className="absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground"
          style={{ left: `${x(series.length - 1)}%`, top: `${y(latest.margin)}%` }}
        />
      </div>
    </div>
  );
}
