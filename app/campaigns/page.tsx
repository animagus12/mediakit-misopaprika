import type { Metadata } from "next";
import AppShell from "@/components/common/AppShell";
import { CampaignsListSection } from "@/components/campaigns/CampaignsListSection";
import { campaignRepository } from "@/repositories/campaignRepository";
import { earningsRepository } from "@/repositories/earnings";
import { getBrands } from "@/repositories/brands.writer.server";
import { buildCampaignBrandOptions } from "@/lib/campaigns";
import type { Campaign } from "@/repositories/campaigns";
import type { EarningsSummary } from "@/repositories/earnings";

export const metadata: Metadata = {
  title: "Campaigns - @misopaprika",
  robots: { index: false, follow: false },
};

// Same reason /calendar carries this: the page is invalidated by the clock as
// well as by a write. Nothing is written when a licence crosses into its last
// thirty days or runs out entirely, but the renewals card changes what it says
// and a cached render would keep offering yesterday's decisions.
export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  let campaigns: Campaign[] = [];
  let earnings: EarningsSummary | null = null;
  let error: string | null = null;
  try {
    [campaigns, earnings] = await Promise.all([
      campaignRepository.getAll(),
      earningsRepository.getSummary().catch(() => null),
    ]);
  } catch (err) {
    error = err instanceof Error ? err.message : "Something went wrong";
  }
  const brandOptions = buildCampaignBrandOptions(await getBrands().catch(() => []));

  return (
    <AppShell>
      <div className="mx-auto max-w-screen-lg xl:max-w-6xl 2xl:max-w-[1440px] space-y-8 px-4 py-10">
        <CampaignsListSection
          campaigns={campaigns}
          earnings={earnings}
          error={error}
          brandOptions={brandOptions}
        />
      </div>
    </AppShell>
  );
}
