import { ArrowDownRight, ArrowUpRight, Building2, Package, Repeat, ScrollText } from "lucide-react";
import { formatMoney } from "@/lib/invoice";
import { cn } from "@/lib/utils";
import { CONCENTRATION_WARNING_PERCENT, type RevenueMix } from "@/lib/revenueMix";
import { StatTile } from "./StatTile";

// Percentages here are shares of a book worth tens of thousands of rupees, so
// a decimal place is noise: nobody acts differently on 18.7% than on 19%.
function percent(value: number): string {
  return `${Math.round(value)}%`;
}

function points(value: number): string {
  const rounded = Math.abs(Math.round(value));
  return `${rounded} point${rounded === 1 ? "" : "s"}`;
}

/**
 * Which way the barter share is moving, and how that reads.
 *
 * Rising is the cautionary direction, which is the whole reason this arrow
 * exists: barter cannot pay an editor or a rent, so a book quietly converting
 * from cash to parcels gets busier without getting richer, and the rupee
 * figure the dashboard already showed hides that completely.
 *
 * A move of under a point is treated as no move: three months of deals is a
 * small enough sample that a fractional drift is noise wearing an arrow.
 */
function BarterDirection({ deltaPoints }: { deltaPoints: number }) {
  if (Math.abs(deltaPoints) < 1) return null;
  const rising = deltaPoints > 0;
  const Icon = rising ? ArrowUpRight : ArrowDownRight;
  return (
    <Icon
      className={cn(
        "inline size-4 align-middle",
        rising ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
      )}
      aria-hidden
    />
  );
}

interface RevenueMixCardProps {
  mix: RevenueMix;
  className?: string;
}

/**
 * What kind of income this is, rather than how much of it there is.
 *
 * Every figure on the dashboard above this one is a rupee total. None of them
 * can answer whether the book rests on one name, whether first deals turn into
 * second ones, or whether a growing share of the work is being paid for in
 * parcels. All three are divisions of numbers already stored, and all three
 * change what the creator should do next in a way another total does not.
 *
 * Renders nothing on an empty book: shares of zero are not a cautious reading,
 * they are a made-up one.
 */
export function RevenueMixCard({ mix, className }: RevenueMixCardProps) {
  const { concentration, barter, renewals } = mix;
  if (concentration.total <= 0) return null;

  const { top } = concentration;
  const concentrated = top !== null && top.percent >= CONCENTRATION_WARNING_PERCENT;

  const barterHint =
    barter.deltaPoints === null
      ? `${formatMoney(barter.barter)} of ${formatMoney(barter.total)} received`
      : Math.abs(barter.deltaPoints) < 1
        ? "flat against the prior quarter"
        : `${barter.deltaPoints > 0 ? "up" : "down"} ${points(barter.deltaPoints)} on the prior quarter`;

  return (
    <section className={cn("space-y-3", className)}>
      <div className="space-y-0.5">
        <h2 className="font-heading text-sm font-semibold">Revenue mix</h2>
        {/* The top-three share rides on this line rather than taking a tile of
            its own. It is the context the tiles are read against, and as a
            fifth tile it left one card stranded on a row of four. */}
        <p className="text-xs text-muted-foreground">
          Across {formatMoney(concentration.total)} booked from {concentration.deals} deal
          {concentration.deals === 1 ? "" : "s"} with {concentration.brands} brand
          {concentration.brands === 1 ? "" : "s"}, received and pending. The largest three are{" "}
          {percent(concentration.topThreePercent)} of it.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {top !== null && (
          <StatTile
            icon={Building2}
            label="Biggest brand"
            value={percent(top.percent)}
            hint={`${top.brand} · ${formatMoney(top.value)}`}
            // Amber only past the stated threshold, because this tile is the
            // one place on the dashboard where a large number is bad news.
            tone={concentrated ? "risk" : "neutral"}
            title={
              concentrated
                ? `Over ${CONCENTRATION_WARNING_PERCENT}% of everything booked comes from one brand. Losing it costs that much of the book at a month's notice.`
                : undefined
            }
            href={top.brandId ? `/brands/${top.brandId}` : "/brands"}
          />
        )}
        <StatTile
          icon={Repeat}
          label="Brands that came back"
          value={percent(concentration.repeatPercent)}
          hint={`${concentration.repeatBrands} of ${concentration.brands} · ${percent(concentration.repeatRevenuePercent)} of income`}
          tone="action"
          href="/brands"
        />
        <StatTile
          icon={Package}
          label="Barter share"
          value={
            <span className="inline-flex items-center gap-1">
              {percent(barter.percent)}
              {barter.deltaPoints !== null && <BarterDirection deltaPoints={barter.deltaPoints} />}
            </span>
          }
          hint={barterHint}
          tone="barter"
          title="Barter as a share of everything received. The arrow compares the last three complete months against the three before them."
          href="/campaigns"
        />

        {/* Only once a licence has actually been sold. A permanent 0% would be
            a tile spent saying nothing, the same call MoneyFlowCard's margin
            tile and the campaigns table's usage column make. */}
        {renewals.count > 0 && (
          <StatTile
            icon={ScrollText}
            label="Licensing"
            value={percent(renewals.percent)}
            hint={`${renewals.count} renewal${renewals.count === 1 ? "" : "s"} across ${renewals.brands} brand${renewals.brands === 1 ? "" : "s"}`}
            tone="cash"
            href="/campaigns"
          />
        )}
      </div>
    </section>
  );
}
