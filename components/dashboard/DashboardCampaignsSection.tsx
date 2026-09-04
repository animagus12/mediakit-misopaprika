import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Campaign } from "@/repositories/campaigns";
import { computeCampaignStats, type CampaignBrandOption } from "@/lib/campaigns";
import { formatMoney } from "@/lib/invoice";
import { ActiveCampaignCard } from "./ActiveCampaignCard";

interface DashboardCampaignsSectionProps {
  active: Campaign[];
  past: Campaign[];
  error?: string | null;
  brandOptions?: CampaignBrandOption[];
}

export function DashboardCampaignsSection({ active, past, error, brandOptions = [] }: DashboardCampaignsSectionProps) {
  if (error) {
    return (
      <section className="mb-8">
        <SectionHeader />
        <Card>
          <CardContent className="py-6 text-xs text-muted-foreground">
            Couldn&apos;t load campaigns — {error}
          </CardContent>
        </Card>
      </section>
    );
  }

  // Counted across the full history (not just `active`) so "Total campaigns"
  // and "Highest-value campaign" stay lifetime figures even though past
  // campaigns are no longer listed here — that detail lives on /campaigns.
  const stats = computeCampaignStats([...active, ...past]);

  return (
    <section className="mb-8 space-y-4">
      <SectionHeader />

      {stats.total > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardDescription>Total campaigns</CardDescription>
              <CardTitle className="text-lg">{stats.total}</CardTitle>
              {stats.cancelled > 0 && (
                <p className="text-xs text-muted-foreground">{stats.cancelled} cancelled</p>
              )}
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Highest-value campaign</CardDescription>
              <CardTitle className="text-lg">
                {stats.highestValue ? formatMoney(stats.highestValue.total) : "—"}
              </CardTitle>
              {stats.highestValue && (
                <p className="truncate text-xs text-muted-foreground">
                  {stats.highestValue.brand}
                </p>
              )}
            </CardHeader>
          </Card>
        </div>
      )}

      {active.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-xs text-muted-foreground">
            No active or upcoming campaigns right now.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {active.map((campaign) => (
            <ActiveCampaignCard key={campaign.id} campaign={campaign} brandOptions={brandOptions} />
          ))}
        </div>
      )}
    </section>
  );
}

// "New campaign" lives in QuickActions at the top of the dashboard instead of
// here — it's the most important add-action on the site, so it stays with
// the other quick actions rather than buried inside this section.
function SectionHeader() {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="space-y-1">
        <h2 className="font-heading text-sm font-semibold">Campaigns</h2>
      </div>
      <Button asChild size="sm" variant="ghost">
        <Link href="/campaigns">View all</Link>
      </Button>
    </div>
  );
}
