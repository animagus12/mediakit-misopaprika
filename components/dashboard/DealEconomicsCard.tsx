import { Banknote, CircleSlash, Hourglass, Tag } from "lucide-react";
import { formatMoney } from "@/lib/invoice";
import { cn } from "@/lib/utils";
import type { RateRealization } from "@/lib/rateCard";
import type { FallthroughRate, PipelineValue } from "@/lib/dealFlow";
import { StatTile } from "./StatTile";

function percent(value: number): string {
  return `${Math.round(value)}%`;
}

interface DealEconomicsCardProps {
  /** null when the media kit carries no parseable base price to compare against. */
  realization: RateRealization | null;
  pipeline: PipelineValue;
  fallthrough: FallthroughRate;
  className?: string;
}

/**
 * What deals actually sell for, what is still owed in work, and what never
 * happened.
 *
 * The published rate card and the closed prices sat in two files that had
 * never been divided by each other, which is the one number this dataset most
 * wants to produce: a creator who knows they close at two thirds of card can
 * either raise the card or stop discounting, and one who does not know it can
 * do neither. The pipeline deals were on the dashboard already, as cards, with
 * no value attached; the cancelled and scam rows were filed where they could
 * be read one at a time and never counted.
 *
 * Renders nothing when there is no rate to compare and no pipeline to value,
 * which on an empty book is every tile here.
 */
export function DealEconomicsCard({
  realization,
  pipeline,
  fallthrough,
  className,
}: DealEconomicsCardProps) {
  if (realization === null && pipeline.count === 0 && fallthrough.lost === 0) return null;

  return (
    <section className={cn("space-y-3", className)}>
      <div className="space-y-0.5">
        <h2 className="font-heading text-sm font-semibold">Deal economics</h2>
        <p className="text-xs text-muted-foreground">
          {realization === null
            ? "Across every deal on the record"
            : `Closed prices against the rate card's ${formatMoney(realization.packagePrice)} Reel + Story`}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {realization !== null && (
          <>
            <StatTile
              icon={Tag}
              label="Closing at"
              value={percent(realization.valuePercent)}
              hint={`of card, across ${realization.deals} priced deal${realization.deals === 1 ? "" : "s"}`}
              // The exclusions are named on hover rather than under every
              // tile: a realization rate quoted without the holes in its
              // denominator is the kind of number that gets acted on twice.
              title={
                realization.unpriced > 0
                  ? `Cash and barter together, against ${formatMoney(realization.cardValue)} at card. ${realization.unpriced} deal${realization.unpriced === 1 ? " carrying no value is" : "s carrying no value are"} left out: a deal nobody priced is not a deal closed for nothing.`
                  : `Cash and barter together, against ${formatMoney(realization.cardValue)} at card.`
              }
              href="/campaigns"
            />
            <StatTile
              icon={Banknote}
              label="In cash alone"
              value={percent(realization.cashPercent)}
              hint={`${formatMoney(realization.averagePackageValue)} average per package`}
              title="The same comparison with barter value taken out: what the deals brought in that can actually pay an editor."
              tone="cash"
              href="/campaigns"
            />
          </>
        )}

        <StatTile
          icon={Hourglass}
          label="In the pipeline"
          value={formatMoney(pipeline.total)}
          hint={
            pipeline.count === 0
              ? "nothing agreed and undelivered"
              : `${pipeline.count} deal${pipeline.count === 1 ? "" : "s"} committed, not delivered${pipeline.unpriced > 0 ? ` · ${pipeline.unpriced} unpriced` : ""}`
          }
          tone="pending"
          href="/campaigns?tab=active"
        />

        <StatTile
          icon={CircleSlash}
          label="Fell through"
          value={percent(fallthrough.percent)}
          hint={`${fallthrough.lost} of ${fallthrough.total} deals${fallthrough.lostValue > 0 ? ` · ${formatMoney(fallthrough.lostValue)} lost` : ""}`}
          title={`${fallthrough.calledOff} called off, ${fallthrough.scam} marked a scam. A deal that was both is counted once.`}
          tone="out"
          href="/campaigns?tab=cancelled"
        />
      </div>
    </section>
  );
}
