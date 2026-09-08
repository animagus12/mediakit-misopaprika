import type { Metadata } from "next";
import AppShell from "@/components/common/AppShell";
import { CampaignsListSection } from "@/components/campaigns/CampaignsListSection";
import { campaignRepository } from "@/repositories/campaignRepository";
import { earningsRepository } from "@/repositories/earnings";
import { getBrands } from "@/repositories/brands.writer.server";
import { buildCampaignBrandOptions } from "@/lib/campaigns";
import { buildEditorVideoOptions } from "@/lib/contentPlan";
import { getContentItems } from "@/repositories/contentPlan.writer.server";
import { getEditorTransactions } from "@/repositories/editorTransactions.writer.server";
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
  // The pickers inside the campaign form. A failure to read either store
  // costs one <Select> and not the page, so both are caught rather than
  // joining the two the page is actually about.
  const [brands, editorTransactions, contentItems] = await Promise.all([
    getBrands().catch(() => []),
    getEditorTransactions().catch(() => []),
    getContentItems().catch(() => []),
  ]);
  const brandOptions = buildCampaignBrandOptions(brands);
  // Both stores that can claim a cut are counted, so a job already on the
  // plan or on another deal is offered marked rather than as free.
  const videoOptions = buildEditorVideoOptions(editorTransactions, [...contentItems, ...campaigns]);

  return (
    <AppShell>
      <div className="mx-auto max-w-screen-lg xl:max-w-6xl 2xl:max-w-[1440px] space-y-8 px-4 py-10">
        <CampaignsListSection
          campaigns={campaigns}
          earnings={earnings}
          error={error}
          brandOptions={brandOptions}
          videoOptions={videoOptions}
        />
      </div>
    </AppShell>
  );
}
