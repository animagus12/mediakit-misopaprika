import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AppShell from "@/components/common/AppShell";
import { InvoiceGenerator } from "@/components/invoice/InvoiceGenerator";
import {
  buildInvoiceBrandOptions,
  buildInvoiceDealOptions,
  buildInvoiceEditorJobOptions,
  invoiceOwner,
  toInvoiceLinkedCampaign,
} from "@/lib/invoice";
import { campaignRepository } from "@/repositories/campaignRepository";
import { getInvoiceData } from "@/repositories/invoice.writer.server";
import { getInvoices } from "@/repositories/invoices.writer.server";
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

  const [data, invoices, brands, contacts, editorTransactions, campaigns, mediaKitHandle] = await Promise.all([
    getInvoiceData(),
    getInvoices(),
    getBrands(),
    getContacts(),
    getEditorTransactions(),
    // Best-effort: without it the editor just can't name the linked campaign.
    campaignRepository.getAll().catch(() => []),
    // Best-effort: the header falls back to the invoice default's handle.
    getMediaKitData().then(
      (kit) => kit.header.handle,
      () => ""
    ),
  ]);

  // Taken from the list rather than read again: every invoice comes out of
  // the same join, and a second read would fetch the whole ledger twice.
  const invoice = invoices.find((entry) => entry.id === id);
  if (!invoice) notFound();
  const owner = invoiceOwner(invoice.id, campaigns);
  const linkedCampaign = toInvoiceLinkedCampaign(owner);
  // The rate a payment recorded from this invoice's page starts its TDS at.
  const ownerRenewal = owner?.renewalId
    ? owner.campaign.usage.renewals.find((renewal) => renewal.id === owner.renewalId)
    : undefined;
  const ownerTdsRate = ownerRenewal?.tdsRate ?? owner?.campaign.tdsRate ?? null;
  const dealOptions = owner ? [] : buildInvoiceDealOptions(invoice, campaigns);

  const takenInvoiceNumbers = invoices
    .filter((other) => other.id !== id)
    .map((other) => other.invoiceNo);

  // Keep the invoice header handle in sync with the media kit's.
  const brandHandle = mediaKitHandle || data.brandHandle;

  return (
    <AppShell>
      <InvoiceGenerator
        data={{ ...data, brandHandle }}
        invoice={invoice}
        linkedCampaign={linkedCampaign}
        ownerTdsRate={ownerTdsRate}
        dealOptions={dealOptions}
        takenInvoiceNumbers={takenInvoiceNumbers}
        brandOptions={buildInvoiceBrandOptions(brands, contacts)}
        editorJobOptions={buildInvoiceEditorJobOptions(editorTransactions, { invoices, currentInvoiceId: id })}
      />
    </AppShell>
  );
}
