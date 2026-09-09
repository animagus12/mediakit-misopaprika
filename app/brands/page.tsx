import { Suspense } from "react";
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
import { getCheckIns } from "@/repositories/brandCheckIns.writer.server";
import { getMediaKitData } from "@/repositories/mediakit.writer.server";
import { fetchBrandCampaignRecords, type BrandCampaignRecord } from "@/repositories/brandCampaigns";
import { computeStatsByBrand } from "@/lib/brandCampaignStats";
import { buildBrandRows, computePipelineStats, unassignedMediaKitLogos } from "@/lib/brands";

export const metadata: Metadata = {
  title: "Brands - @misopaprika",
  robots: { index: false, follow: false },
};

export default async function BrandsPage() {
  const [brands, agencies, contacts, mediaKitData, checkIns] = await Promise.all([
    getBrands(),
    getAgencies(),
    getContacts(),
    getMediaKitData(),
    // Best-effort: the check-in log only annotates the Status column, so a
    // Redis hiccup here costs a hint rather than the page.
    getCheckIns().catch(() => []),
  ]);

  let records: BrandCampaignRecord[] = [];
  let campaignError: string | null = null;
  try {
    records = await fetchBrandCampaignRecords();
  } catch (err) {
    campaignError = err instanceof Error ? err.message : "Something went wrong";
  }

  const statsByBrand = computeStatsByBrand(brands, records);
  // Rows first: the tiles count the same derived statuses the table shows, so
  // a tile and the tab it links to never disagree.
  const rows = buildBrandRows(brands, agencies, contacts, statsByBrand, records, checkIns);
  const pipelineStats = computePipelineStats(rows, statsByBrand);
  const unassignedLogos = unassignedMediaKitLogos(mediaKitData.collabs.logos, brands);
  const brandsWithoutLogo = brands
    .filter((brand) => !brand.logoUrl)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  return (
    <AppShell>
      <div className="mx-auto max-w-screen-lg xl:max-w-6xl 2xl:max-w-[1440px] space-y-8 px-4 py-10">
        {/* Stacked on a phone: side by side, the two buttons took the row and
            squeezed the description into a six-line column. */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h1 className="font-heading text-lg font-semibold">Brands</h1>
            <p className="text-xs text-muted-foreground">Brand, agency, and contact relationships in one place.</p>
          </div>
          <div className="flex shrink-0 items-start gap-2">
            <ImportBrandsButton />
            <NewBrandButton agencies={agencies} contacts={contacts} />
          </div>
        </div>

        {campaignError && (
          <Card>
            <CardContent className="py-3 text-xs text-muted-foreground">
              Campaign history and revenue couldn&apos;t be loaded: {campaignError}. Brand records
              below are still up to date.
            </CardContent>
          </Card>
        )}

        <BrandsStatCards stats={pipelineStats} />

        <MediaKitLogosSection logos={unassignedLogos} brands={brandsWithoutLogo} />

        {/* The table is what the page is for, so it comes before the agency
            roster: an agency is looked up on purpose, a brand is landed on. */}
        <Suspense fallback={<div className="h-64 rounded-md border border-border" />}>
          <BrandsTable rows={rows} />
        </Suspense>

        <AgenciesSection agencies={agencies} brands={brands} contacts={contacts} />
      </div>
    </AppShell>
  );
}
