import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/invoice";
import { computeAffiliateTotals, computePartnerPerformance } from "@/lib/affiliates";
import { cn } from "@/lib/utils";
import type { AffiliatePartner } from "@/repositories/affiliatePartners";
import type { AffiliatePayout } from "@/repositories/affiliatePayouts";
import { AffiliatePayoutsTable } from "./AffiliatePayoutsTable";
import { NewPartnerButton } from "./NewPartnerButton";
import { NewPayoutButton } from "./NewPayoutButton";
import { PartnerCard } from "./PartnerCard";
import type { BrandOption, LinkItemOption } from "./PartnerFormFields";

// The same tone system the workspace and earnings tiles use, so a money tile
// reads the same everywhere in the app.
const STAT_TONES = {
  neutral: { card: "", value: "" },
  commission: {
    card: "bg-violet-500/5 ring-violet-500/15",
    value: "text-violet-600 dark:text-violet-400",
  },
  pending: {
    card: "bg-amber-500/5 ring-amber-500/15",
    value: "text-amber-600 dark:text-amber-400",
  },
  info: { card: "bg-sky-500/5 ring-sky-500/15", value: "text-sky-600 dark:text-sky-400" },
} as const;

interface AffiliatesSectionProps {
  partners: AffiliatePartner[];
  payouts: AffiliatePayout[];
  /** Clicks per LinkItem.id, from the /links counters. */
  clicksByItem: Record<string, number>;
  brands: BrandOption[];
  linkItems: LinkItemOption[];
  error?: string | null;
}

export function AffiliatesSection({
  partners,
  payouts,
  clicksByItem,
  brands,
  linkItems,
  error,
}: AffiliatesSectionProps) {
  if (error) {
    return (
      <section className="space-y-4">
        <Header partners={partners} brands={brands} linkItems={linkItems} />
        <Card>
          <CardContent className="py-6 text-xs text-muted-foreground">
            Couldn&apos;t load affiliate data: {error}
          </CardContent>
        </Card>
      </section>
    );
  }

  const totals = computeAffiliateTotals(partners, payouts);
  const performances = partners.map((partner) =>
    computePartnerPerformance(
      partner,
      payouts,
      partner.linkItemId ? (clicksByItem[partner.linkItemId] ?? 0) : 0
    )
  );

  const stats = [
    { label: "Commission earned", value: formatMoney(totals.received), tone: STAT_TONES.commission },
    { label: "Awaiting payout", value: formatMoney(totals.pending), tone: STAT_TONES.pending },
    { label: "Sales driven", value: formatMoney(totals.grossSales), tone: STAT_TONES.info },
    { label: "Orders", value: String(totals.salesCount), tone: STAT_TONES.neutral },
  ];

  return (
    <section className="space-y-6">
      <Header partners={partners} brands={brands} linkItems={linkItems} />

      {payouts.length > 0 && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.label} className={stat.tone.card}>
              <CardHeader>
                <CardDescription>{stat.label}</CardDescription>
                <CardTitle className={cn("text-lg tabular-nums", stat.tone.value)}>
                  {stat.value}
                </CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {partners.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-xs text-muted-foreground">
            No affiliate partners yet. Add one to start tracking commission against a creator code.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {performances.map((performance) => (
            <PartnerCard
              key={performance.partner.id}
              performance={performance}
              brands={brands}
              linkItems={linkItems}
            />
          ))}
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-heading text-sm font-semibold">Payout history</h2>
          <NewPayoutButton partners={partners} />
        </div>

        {payouts.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-xs text-muted-foreground">
              No payouts recorded yet. Enter each period from the brand&apos;s own dashboard as it
              closes.
            </CardContent>
          </Card>
        ) : (
          <AffiliatePayoutsTable payouts={payouts} partners={partners} />
        )}
      </div>
    </section>
  );
}

function Header({
  partners,
  brands,
  linkItems,
}: {
  partners: AffiliatePartner[];
  brands: BrandOption[];
  linkItems: LinkItemOption[];
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="space-y-1">
        <h1 className="font-heading text-lg font-semibold">Affiliates</h1>
        <p className="text-xs text-muted-foreground">
          Creator codes, the commission each period paid, and how well the codes convert.
          {partners.length > 0 && " Commission counts toward earnings alongside deals and barter."}
        </p>
      </div>
      <NewPartnerButton brands={brands} linkItems={linkItems} />
    </div>
  );
}
