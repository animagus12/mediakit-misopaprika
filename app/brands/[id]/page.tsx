import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AppShell from "@/components/common/AppShell";
import { BrandDetailHeader } from "@/components/brands/BrandDetailHeader";
import { BrandSummaryCards } from "@/components/brands/BrandSummaryCards";
import { BrandTabsSection } from "@/components/brands/BrandTabsSection";
import type { BrandAffiliateProgram } from "@/components/brands/BrandAffiliateCommission";
import { Card, CardContent } from "@/components/ui/card";
import { getAgencies } from "@/repositories/agencies.writer.server";
import { getBrand } from "@/repositories/brands.writer.server";
import { getContacts } from "@/repositories/contacts.writer.server";
import { getBrandNotes } from "@/repositories/brandNotes.writer.server";
import { getCampaignContacts } from "@/repositories/campaignContacts.writer.server";
import { getInvoices } from "@/repositories/invoices.writer.server";
import { getEditorTransactions } from "@/repositories/editorTransactions.writer.server";
import { getAffiliatePartners } from "@/repositories/affiliatePartners.writer.server";
import { getAffiliatePayouts } from "@/repositories/affiliatePayouts.writer.server";
import { fetchBrandCampaignRecords, type BrandCampaignRecord } from "@/repositories/brandCampaigns";
import { computeBrandStats, recordsForBrand } from "@/lib/brandCampaignStats";
import { isCampaignCancelled } from "@/lib/campaigns";
import { buildInvoiceEditorJobOptions, invoicesForBrand, type InvoiceEditorJobOption } from "@/lib/invoice";
import { sortPayoutsByPeriod } from "@/lib/affiliates";
import { contactsForBrand } from "@/lib/contacts";
import { missingBrandDetails } from "@/lib/brands";
import type { Invoice } from "@/repositories/invoices";

export const metadata: Metadata = {
  title: "Brand - @misopaprika",
  robots: { index: false, follow: false },
};

interface BrandDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function BrandDetailPage({ params }: BrandDetailPageProps) {
  const { id } = await params;

  // None of the reads below needs the brand to start, so every one begins
  // here and they all share one round trip instead of waiting in turn. The
  // optional ones settle their own failure as they start, so none can go
  // unhandled when the required batch throws or the brand 404s first.
  const campaignRead = fetchBrandCampaignRecords().then(
    (all) => ({ all, error: null }),
    (err: unknown) => ({
      all: [] as BrandCampaignRecord[],
      error: err instanceof Error ? err.message : "Something went wrong",
    })
  );
  // Best-effort: a Redis hiccup on invoices/editor jobs shouldn't take down
  // the whole brand page; the Invoices tab just shows empty.
  const invoiceRead = Promise.all([getInvoices(), getEditorTransactions()]).catch(() => null);
  // Affiliate programs this brand runs, with their payouts. Best-effort for
  // the same reason invoices are: a Redis hiccup here costs one block on the
  // Payments tab rather than the brand page.
  const affiliateRead = Promise.all([getAffiliatePartners(), getAffiliatePayouts()]).catch(() => null);

  const [brand, agencies, contacts, notes, campaignContacts] = await Promise.all([
    getBrand(id),
    getAgencies(),
    getContacts(),
    getBrandNotes(),
    getCampaignContacts(),
  ]);

  if (!brand) notFound();

  const [campaignResult, invoiceResult, affiliateResult] = await Promise.all([
    campaignRead,
    invoiceRead,
    affiliateRead,
  ]);

  // A cancelled deal never happened commercially: same convention as
  // lib/brandCampaignStats.ts's computeBrandStats, but applied here too
  // so cancelled rows don't show up in the Campaigns/Payments tabs either.
  const records = recordsForBrand(brand, campaignResult.all).filter(
    (record) => !isCampaignCancelled(record.status)
  );
  const sheetError = campaignResult.error;

  const brandInvoices: Invoice[] = invoiceResult ? invoicesForBrand(brand, invoiceResult[0]) : [];
  const editorJobs: InvoiceEditorJobOption[] = invoiceResult
    ? buildInvoiceEditorJobOptions(invoiceResult[1])
    : [];

  // Joined on brandId only, with no name fallback: a program is linked
  // explicitly in the partner form, so an unlinked one is unlinked on purpose.
  const affiliates: BrandAffiliateProgram[] = affiliateResult
    ? affiliateResult[0]
        .filter((partner) => partner.brandId === brand.id)
        .map((partner) => ({
          partner,
          payouts: sortPayoutsByPeriod(affiliateResult[1].filter((payout) => payout.partnerId === partner.id)),
        }))
    : [];

  const agency = brand.agencyId ? (agencies.find((a) => a.id === brand.agencyId) ?? null) : null;
  const brandContacts = contactsForBrand(brand, contacts);
  const brandNotes = notes.filter((note) => note.brandId === brand.id);
  const brandCampaignContacts = campaignContacts.filter((cc) => cc.brandId === brand.id);
  const stats = computeBrandStats(records);
  const missingDetails = missingBrandDetails(brand, brandContacts.length > 0);

  return (
    <AppShell>
      <div className="mx-auto max-w-screen-lg xl:max-w-6xl 2xl:max-w-[1440px] space-y-6 px-4 py-10">
        <BrandDetailHeader
          brand={brand}
          agencyName={agency?.name ?? null}
          agencies={agencies}
          contacts={contacts}
          missingDetails={missingDetails}
        />

        {sheetError && (
          <Card>
            <CardContent className="py-3 text-xs text-muted-foreground">
              Campaign history and revenue couldn&apos;t be loaded: {sheetError}.
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
          invoices={brandInvoices}
          editorJobs={editorJobs}
          affiliates={affiliates}
        />
      </div>
    </AppShell>
  );
}
