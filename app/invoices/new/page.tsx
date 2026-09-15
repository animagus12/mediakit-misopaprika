import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AppShell from "@/components/common/AppShell";
import { InvoiceGenerator } from "@/components/invoice/InvoiceGenerator";
import { buildCampaignInvoice } from "@/lib/campaignInvoice";
import { primaryContactForBrand } from "@/lib/contacts";
import {
  buildInvoiceBrandOptions,
  buildInvoiceEditorJobOptions,
  resolveCampaignInvoice,
  todayISO,
} from "@/lib/invoice";
import { campaignRepository } from "@/repositories/campaignRepository";
import { getInvoiceData } from "@/repositories/invoice.writer.server";
import { getInvoices } from "@/repositories/invoices.writer.server";
import { getBrands } from "@/repositories/brands.writer.server";
import { getContacts } from "@/repositories/contacts.writer.server";
import { getEditorTransactions } from "@/repositories/editorTransactions.writer.server";
import { getMediaKitData } from "@/repositories/mediakit.writer.server";
import type { NewInvoice } from "@/repositories/invoices";

export const metadata: Metadata = {
  title: "New invoice - @misopaprika",
  robots: { index: false, follow: false },
};

interface NewInvoicePageProps {
  searchParams: Promise<{ brandId?: string; campaign?: string; client?: string; campaignId?: string }>;
}

export default async function NewInvoicePage({ searchParams }: NewInvoicePageProps) {
  const { brandId, campaign, client, campaignId } = await searchParams;
  const data = await getInvoiceData();

  // The handle shown on the invoice header is the media kit's handle, so the
  // two never drift apart. Best-effort: falls back to the invoice default.
  let brandHandle = data.brandHandle;
  try {
    brandHandle = (await getMediaKitData()).header.handle || brandHandle;
  } catch {
    // keep the default
  }

  // Best-effort: the editor still works if any of these can't be loaded; it
  // just can't warn about clashes or offer the brand / editor-job pickers.
  let takenInvoiceNumbers: string[] = [];
  let brandOptions: ReturnType<typeof buildInvoiceBrandOptions> = [];
  let editorJobOptions: ReturnType<typeof buildInvoiceEditorJobOptions> = [];
  // Raised from a deal: the whole invoice is built from what the deal stores.
  // A deal that already has one opens that instead, since a second invoice for
  // money owed once is worse than none. Best-effort like the rest: a deal that
  // can't be read falls back to a blank editor rather than an error page.
  let prefill: NewInvoice | undefined;
  let existingInvoiceId: string | null = null;
  try {
    const [invoices, brands, contacts, editorTransactions, campaigns] = await Promise.all([
      getInvoices(),
      getBrands(),
      getContacts(),
      getEditorTransactions(),
      campaignId ? campaignRepository.getAll() : Promise.resolve([]),
    ]);
    takenInvoiceNumbers = invoices.map((invoice) => invoice.invoiceNo);
    brandOptions = buildInvoiceBrandOptions(brands, contacts);
    editorJobOptions = buildInvoiceEditorJobOptions(editorTransactions);

    const deal = campaigns.find((entry) => entry.id === campaignId);
    if (deal) {
      existingInvoiceId = resolveCampaignInvoice(deal, invoices)?.id ?? null;
      const brand = deal.brandId ? brands.find((entry) => entry.id === deal.brandId) : undefined;
      prefill = buildCampaignInvoice({
        campaign: deal,
        defaults: data,
        existing: invoices,
        contactName: brand ? (primaryContactForBrand(brand, contacts)?.name ?? "") : "",
        today: todayISO(),
      });
    }
  } catch {
    // keep the fallbacks
  }
  // Outside the try: redirect works by throwing.
  if (existingInvoiceId) redirect(`/invoices/${existingInvoiceId}`);

  return (
    <AppShell>
      <InvoiceGenerator
        data={{ ...data, brandHandle }}
        takenInvoiceNumbers={takenInvoiceNumbers}
        brandOptions={brandOptions}
        editorJobOptions={editorJobOptions}
        prefill={prefill}
        campaignId={prefill ? campaignId : undefined}
        initialBrandId={brandId}
        initialCampaignName={campaign}
        initialClientName={client}
      />
    </AppShell>
  );
}
