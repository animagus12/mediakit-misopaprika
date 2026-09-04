import type { Metadata } from "next";
import AppShell from "@/components/common/AppShell";
import { AgenciesSection } from "@/components/brands/AgenciesSection";
import { BrandsStatCards } from "@/components/brands/BrandsStatCards";
import { BrandsTable } from "@/components/brands/BrandsTable";
import { ImportBrandsButton } from "@/components/brands/ImportBrandsButton";
import { MediaKitLogosSection } from "@/components/brands/MediaKitLogosSection";
import { NewBrandButton } from "@/components/brands/NewBrandButton";
import { Card, CardContent } from "@/components/ui/card";
import { getAgencies } from "@/repositories/agencies.writer.server";
import { getBrands } from "@/repositories/brands.writer.server";
import { getContacts } from "@/repositories/contacts.writer.server";
import { getMediaKitData } from "@/repositories/mediakit.writer.server";
import { fetchBrandCampaignRecords, type BrandCampaignRecord } from "@/repositories/brandCampaigns";
import { computeStatsByBrand } from "@/lib/brandCampaignStats";
import { buildBrandRows, computePipelineStats, unassignedMediaKitLogos } from "@/lib/brands";

export const metadata: Metadata = {
  title: "Brands - @misopaprika",
  robots: { index: false, follow: false },
};

export default async function BrandsPage() {
  const [brands, agencies, contacts, mediaKitData] = await Promise.all([
    getBrands(),
    getAgencies(),
    getContacts(),
    getMediaKitData(),
  ]);

  let records: BrandCampaignRecord[] = [];
  let campaignError: string | null = null;
  try {
    records = await fetchBrandCampaignRecords();
  } catch (err) {
    campaignError = err instanceof Error ? err.message : "Something went wrong";
  }

  const statsByBrand = computeStatsByBrand(brands, records);
  const pipelineStats = computePipelineStats(brands, statsByBrand);
  const rows = buildBrandRows(brands, agencies, contacts, statsByBrand, records);
  const unassignedLogos = unassignedMediaKitLogos(mediaKitData.collabs.logos, brands);
  const brandsWithoutLogo = brands
    .filter((brand) => !brand.logoUrl)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  return (
    <AppShell>
      <div className="mx-auto max-w-screen-lg space-y-8 px-4 py-10">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <h1 className="font-heading text-lg font-semibold">Brands</h1>
            <p className="text-xs text-muted-foreground">Brand, agency, and contact relationships in one place.</p>
          </div>
          <div className="flex items-start gap-2">
            <ImportBrandsButton />
            <NewBrandButton agencies={agencies} contacts={contacts} />
          </div>
        </div>

        {campaignError && (
          <Card>
            <CardContent className="py-3 text-xs text-muted-foreground">
              Campaign history and revenue couldn&apos;t be loaded — {campaignError}. Brand records
              below are still up to date.
            </CardContent>
          </Card>
        )}

        <BrandsStatCards stats={pipelineStats} />

        <MediaKitLogosSection logos={unassignedLogos} brands={brandsWithoutLogo} />

        <AgenciesSection agencies={agencies} brands={brands} contacts={contacts} />

        <BrandsTable rows={rows} />
      </div>
    </AppShell>
  );
}
