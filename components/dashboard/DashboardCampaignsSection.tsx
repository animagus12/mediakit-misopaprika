import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Campaign } from "@/repositories/campaigns";
import type { CampaignBrandOption } from "@/lib/campaigns";
import type { EditorVideoOption } from "@/lib/contentPlan";
import { ActiveCampaignCard } from "./ActiveCampaignCard";

// Active and upcoming campaigns only. The full history, and the lifetime
// figures drawn from it, live on /campaigns.
interface DashboardCampaignsSectionProps {
  active: Campaign[];
  error?: string | null;
  brandOptions?: CampaignBrandOption[];
  videoOptions?: EditorVideoOption[];
}

export function DashboardCampaignsSection({
  active,
  error,
  brandOptions = [],
  videoOptions = [],
}: DashboardCampaignsSectionProps) {
  if (error) {
    return (
      <section className="mb-8">
        <SectionHeader />
        <Card>
          <CardContent className="py-6 text-xs text-muted-foreground">
            Couldn&apos;t load campaigns: {error}
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="mb-8 space-y-4">
      <SectionHeader />

      {active.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-xs text-muted-foreground">
            No active or upcoming campaigns right now.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {active.map((campaign) => (
            <ActiveCampaignCard
              key={campaign.id}
              campaign={campaign}
              brandOptions={brandOptions}
              videoOptions={videoOptions}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// "New campaign" lives in QuickActions at the top of the dashboard instead of
// here: it's the most important add-action on the site, so it stays with
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
