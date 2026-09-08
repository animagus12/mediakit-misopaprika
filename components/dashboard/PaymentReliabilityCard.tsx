import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/invoice";
import { cn } from "@/lib/utils";
import {
  RELIABILITY_RATING_LABELS,
  RELIABILITY_RATING_TONES,
  type PaymentReliability,
} from "@/lib/paymentReliability";
import type { BrandReliability, PortfolioReliability } from "@/lib/brandCampaignStats";

// Two, not five: this answers "is there a name I should stop saying yes to",
// and a leaderboard of every brand is a page, not a dashboard row. The full
// ranking is a brand's own Payments tab, one click away.
const WORST_SHOWN = 2;

function facts(reliability: PaymentReliability): string {
  return [
    `${reliability.onTime}/${reliability.sample} on time`,
    reliability.worstDelayDays && reliability.worstDelayDays > 0
      ? `worst ${reliability.worstDelayDays} days`
      : null,
    reliability.overdueAmount > 0 ? `${formatMoney(reliability.overdueAmount)} overdue` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function WorstPayerRow({ brand, brandId, reliability }: BrandReliability) {
  const tone = RELIABILITY_RATING_TONES[reliability.rating];
  const row = (
    <div className="flex items-start justify-between gap-3 rounded-md px-2 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{brand}</p>
        <p className="truncate text-xs text-muted-foreground">{reliability.label}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className={cn("text-sm font-medium tabular-nums", tone.value)}>
          {reliability.score}/100
        </p>
        <p className="text-[11px] text-muted-foreground">{facts(reliability)}</p>
      </div>
    </div>
  );

  // A record that was never linked to a CRM brand has no page to open, so it
  // stays plain text rather than a link that goes nowhere.
  return brandId ? (
    <Link href={`/brands/${brandId}`} className="block rounded-md transition hover:bg-muted/50">
      {row}
    </Link>
  ) : (
    row
  );
}

interface PaymentReliabilityCardProps {
  portfolio: PortfolioReliability;
  className?: string;
}

/**
 * How the whole book pays, and the two names dragging it down.
 *
 * lib/paymentReliability.ts was doing this per brand on a page you only reach
 * by already suspecting someone. The portfolio read is the one that finds them
 * for you: the same scoring, the same exclusions, run across every payment.
 *
 * Renders nothing when no brand has enough history to rate. Silence is the
 * honest output there, not a tile reading "Not enough history" on a dashboard
 * that would then carry it forever on a book of one-off deals.
 */
export function PaymentReliabilityCard({ portfolio, className }: PaymentReliabilityCardProps) {
  const { overall, ranked } = portfolio;
  if (overall.score === null) return null;

  const tone = RELIABILITY_RATING_TONES[overall.rating];
  // Only the brands actually below the portfolio's own standing are worth
  // naming: on a book where everyone pays on time, "slowest payer" is a
  // slur invented by sort order.
  const worst = ranked.filter((entry) => entry.reliability.rating !== "reliable").slice(0, WORST_SHOWN);

  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-heading text-sm font-semibold">Payment reliability</h2>
      </div>

      {/* Two columns whether or not there is a second card: one verdict and
          four short lines stretched the full width of the page read as a
          banner rather than as the tile it is. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className={tone.card}>
          <CardHeader>
            <CardDescription>Across every brand</CardDescription>
            <CardTitle className={cn("text-base", tone.value)}>
              {RELIABILITY_RATING_LABELS[overall.rating]}
              <span className="ml-2 text-xs font-normal tabular-nums text-muted-foreground">
                {overall.score}/100
              </span>
            </CardTitle>
            <p className="text-xs text-muted-foreground">{overall.label}</p>
            <p className="text-[11px] text-muted-foreground">{facts(overall)}</p>
          </CardHeader>
        </Card>

        {worst.length > 0 && (
          <Card>
            <CardHeader>
              <CardDescription>
                {worst.length === 1 ? "Slowest payer" : `Slowest ${worst.length} payers`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-0.5">
              {worst.map((entry) => (
                <WorstPayerRow key={entry.brandId ?? entry.brand} {...entry} />
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  );
}
