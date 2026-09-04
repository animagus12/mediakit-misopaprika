import { Card, CardContent } from "@/components/ui/card";
import { EditCampaignSheet } from "@/components/campaigns/EditCampaignSheet";
import { CampaignStatusSelect } from "@/components/campaigns/CampaignStatusSelect";
import type { CampaignBrandOption } from "@/lib/campaigns";
import type { Campaign } from "@/repositories/campaigns";

// An active-pipeline card: most of it is a stretched hit target that opens
// the full edit sheet (the `absolute inset-0` button), with the status
// <Select> lifted above it (`z-10`) as the one carve-out so the pipeline
// stage can be advanced in place. Keeping the two as DOM siblings — not the
// old badge-inside-a-<button> — avoids the nested-interactive hydration bug.
export function ActiveCampaignCard({
  campaign,
  brandOptions = [],
}: {
  campaign: Campaign;
  brandOptions?: CampaignBrandOption[];
}) {
  return (
    <Card size="sm" className="relative">
      <CardContent className="space-y-0.5">
        <div className="flex items-start justify-between gap-2">
          <span className="min-w-0 truncate pt-1 font-heading text-sm font-medium">
            {campaign.brand}
          </span>
          <div className="relative z-10 shrink-0">
            <CampaignStatusSelect campaign={campaign} />
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="truncate">{campaign.reels || "No reels"}</span>
          <span className="truncate">{campaign.story || "No story"}</span>
          {campaign.date && (
            <span className="ml-auto shrink-0 whitespace-nowrap">{campaign.date}</span>
          )}
        </div>
      </CardContent>

      <EditCampaignSheet
        campaign={campaign}
        brandOptions={brandOptions}
        trigger={
          <button
            type="button"
            aria-label={`Edit ${campaign.brand} campaign`}
            className="absolute inset-0 rounded-lg transition hover:ring-2 hover:ring-primary/20 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
          />
        }
      />
    </Card>
  );
}
