import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AppShell from "@/components/common/AppShell";
import { InvoiceGenerator } from "@/components/invoice/InvoiceGenerator";
import {
  buildInvoiceBrandOptions,
  buildInvoiceEditorJobOptions,
  invoiceOwner,
  toInvoiceLinkedCampaign,
} from "@/lib/invoice";
import { campaignRepository } from "@/repositories/campaignRepository";
import { getInvoiceData } from "@/repositories/invoice.writer.server";
import { getInvoice, getInvoices } from "@/repositories/invoices.writer.server";
import { getBrands } from "@/repositories/brands.writer.server";
import { getContacts } from "@/repositories/contacts.writer.server";
import { getEditorTransactions } from "@/repositories/editorTransactions.writer.server";
import { getMediaKitData } from "@/repositories/mediakit.writer.server";

export const metadata: Metadata = {
  title: "Edit invoice - @misopaprika",
  robots: { index: false, follow: false },
};

interface EditInvoicePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditInvoicePage({ params }: EditInvoicePageProps) {
  const { id } = await params;

  const [data, invoice, invoices, brands, contacts, editorTransactions, campaigns] = await Promise.all([
    getInvoiceData(),
    getInvoice(id),
    getInvoices(),
    getBrands(),
    getContacts(),
    getEditorTransactions(),
    // Best-effort: without it the editor just can't name the linked campaign.
    campaignRepository.getAll().catch(() => []),
  ]);

  if (!invoice) notFound();
  const linkedCampaign = toInvoiceLinkedCampaign(invoiceOwner(invoice.id, campaigns));

  const takenInvoiceNumbers = invoices
    .filter((other) => other.id !== id)
    .map((other) => other.invoiceNo);

  // Keep the invoice header handle in sync with the media kit's. Best-effort.
  let brandHandle = data.brandHandle;
  try {
    brandHandle = (await getMediaKitData()).header.handle || brandHandle;
  } catch {
    // keep the default
  }

  return (
    <AppShell>
      <InvoiceGenerator
        data={{ ...data, brandHandle }}
        invoice={invoice}
        linkedCampaign={linkedCampaign}
        takenInvoiceNumbers={takenInvoiceNumbers}
        brandOptions={buildInvoiceBrandOptions(brands, contacts)}
        editorJobOptions={buildInvoiceEditorJobOptions(editorTransactions)}
      />
    </AppShell>
  );
}
