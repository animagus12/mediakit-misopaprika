import type { Metadata } from "next";
import AppShell from "@/components/common/AppShell";
import { InvoiceGenerator } from "@/components/invoice/InvoiceGenerator";
import { buildInvoiceBrandOptions, buildInvoiceEditorJobOptions } from "@/lib/invoice";
import { getInvoiceData } from "@/repositories/invoice.writer.server";
import { getInvoices } from "@/repositories/invoices.writer.server";
import { getBrands } from "@/repositories/brands.writer.server";
import { getContacts } from "@/repositories/contacts.writer.server";
import { getEditorTransactions } from "@/repositories/editorTransactions.writer.server";
import { getMediaKitData } from "@/repositories/mediakit.writer.server";

export const metadata: Metadata = {
  title: "New invoice - @misopaprika",
  robots: { index: false, follow: false },
};

interface NewInvoicePageProps {
  searchParams: Promise<{ brandId?: string; campaign?: string; client?: string }>;
}

export default async function NewInvoicePage({ searchParams }: NewInvoicePageProps) {
  const { brandId, campaign, client } = await searchParams;
  const data = await getInvoiceData();

  // The handle shown on the invoice header is the media kit's handle, so the
  // two never drift apart. Best-effort — falls back to the invoice default.
  let brandHandle = data.brandHandle;
  try {
    brandHandle = (await getMediaKitData()).header.handle || brandHandle;
  } catch {
    // keep the default
  }

  // Best-effort — the editor still works if any of these can't be loaded; it
  // just can't warn about clashes or offer the brand / editor-job pickers.
  let takenInvoiceNumbers: string[] = [];
  let brandOptions: ReturnType<typeof buildInvoiceBrandOptions> = [];
  let editorJobOptions: ReturnType<typeof buildInvoiceEditorJobOptions> = [];
  try {
    const [invoices, brands, contacts, editorTransactions] = await Promise.all([
      getInvoices(),
      getBrands(),
      getContacts(),
      getEditorTransactions(),
    ]);
    takenInvoiceNumbers = invoices.map((invoice) => invoice.invoiceNo);
    brandOptions = buildInvoiceBrandOptions(brands, contacts);
    editorJobOptions = buildInvoiceEditorJobOptions(editorTransactions);
  } catch {
    // keep the fallbacks
  }

  return (
    <AppShell>
      <InvoiceGenerator
        data={{ ...data, brandHandle }}
        takenInvoiceNumbers={takenInvoiceNumbers}
        brandOptions={brandOptions}
        editorJobOptions={editorJobOptions}
        initialBrandId={brandId}
        initialCampaignName={campaign}
        initialClientName={client}
      />
    </AppShell>
  );
}
