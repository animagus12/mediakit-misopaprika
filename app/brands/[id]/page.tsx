import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AppShell from "@/components/common/AppShell";
import { BrandDetailHeader } from "@/components/brands/BrandDetailHeader";
import { BrandSummaryCards } from "@/components/brands/BrandSummaryCards";
import { BrandTabsSection } from "@/components/brands/BrandTabsSection";
import { Card, CardContent } from "@/components/ui/card";
import { getAgencies } from "@/repositories/agencies.writer.server";
import { getBrand } from "@/repositories/brands.writer.server";
import { getContacts } from "@/repositories/contacts.writer.server";
import { getBrandNotes } from "@/repositories/brandNotes.writer.server";
import { getCampaignContacts } from "@/repositories/campaignContacts.writer.server";
import { fetchBrandCampaignRecords, type BrandCampaignRecord } from "@/repositories/brandCampaigns";
import { computeBrandStats, recordsForBrand } from "@/lib/brandCampaignStats";
import { contactsForBrand } from "@/lib/contacts";

export const metadata: Metadata = {
  title: "Brand - @misopaprika",
  robots: { index: false, follow: false },
};

interface BrandDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function BrandDetailPage({ params }: BrandDetailPageProps) {
  const { id } = await params;

  const [brand, agencies, contacts, notes, campaignContacts] = await Promise.all([
    getBrand(id),
    getAgencies(),
    getContacts(),
    getBrandNotes(),
    getCampaignContacts(),
  ]);

  if (!brand) notFound();

  let records: BrandCampaignRecord[] = [];
  let sheetError: string | null = null;
  try {
    // A cancelled deal never happened commercially — same convention as
    // lib/brandCampaignStats.ts's computeBrandStats, but applied here too
    // so cancelled rows don't show up in the Campaigns/Payments tabs either.
    records = recordsForBrand(brand.name, await fetchBrandCampaignRecords()).filter(
      (record) => record.status.trim().toLowerCase() !== "cancelled"
    );
  } catch (err) {
    sheetError = err instanceof Error ? err.message : "Something went wrong";
  }

  const agency = brand.agencyId ? (agencies.find((a) => a.id === brand.agencyId) ?? null) : null;
  const brandContacts = contactsForBrand(brand, contacts);
  const brandNotes = notes.filter((note) => note.brandId === brand.id);
  const brandCampaignContacts = campaignContacts.filter((cc) => cc.brandId === brand.id);
  const stats = computeBrandStats(records);

  return (
    <AppShell>
      <div className="mx-auto max-w-screen-lg space-y-6 px-4 py-10">
        <BrandDetailHeader brand={brand} agencyName={agency?.name ?? null} agencies={agencies} />

        {sheetError && (
          <Card>
            <CardContent className="py-3 text-xs text-muted-foreground">
              Campaign history and revenue couldn&apos;t be pulled from the sheet — {sheetError}.
            </CardContent>
          </Card>
        )}

        <BrandSummaryCards stats={stats} />

        <BrandTabsSection
          brand={brand}
          agency={agency}
          contacts={brandContacts}
          records={records}
          campaignContacts={brandCampaignContacts}
          stats={stats}
          notes={brandNotes}
        />
      </div>
    </AppShell>
  );
}
