import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AppShell from "@/components/common/AppShell";
import { InvoiceGenerator } from "@/components/invoice/InvoiceGenerator";
import { getInvoiceData } from "@/repositories/invoice.writer.server";
import { getInvoice, getInvoices } from "@/repositories/invoices.writer.server";

export const metadata: Metadata = {
  title: "Edit invoice - @misopaprika",
  robots: { index: false, follow: false },
};

interface EditInvoicePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditInvoicePage({ params }: EditInvoicePageProps) {
  const { id } = await params;

  const [data, invoice, invoices] = await Promise.all([
    getInvoiceData(),
    getInvoice(id),
    getInvoices(),
  ]);

  if (!invoice) notFound();

  const takenInvoiceNumbers = invoices
    .filter((other) => other.id !== id)
    .map((other) => other.invoiceNo);

  return (
    <AppShell>
      <InvoiceGenerator data={data} invoice={invoice} takenInvoiceNumbers={takenInvoiceNumbers} />
    </AppShell>
  );
}
