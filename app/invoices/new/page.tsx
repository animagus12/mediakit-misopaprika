import type { Metadata } from "next";
import AppShell from "@/components/common/AppShell";
import { InvoiceGenerator } from "@/components/invoice/InvoiceGenerator";
import { getInvoiceData } from "@/repositories/invoice.writer.server";
import { getInvoices } from "@/repositories/invoices.writer.server";

export const metadata: Metadata = {
  title: "New invoice - @misopaprika",
  robots: { index: false, follow: false },
};

export default async function NewInvoicePage() {
  const data = await getInvoiceData();

  // Best-effort — the editor still works if the existing-number list can't be
  // loaded; it just can't warn about a clash.
  let takenInvoiceNumbers: string[] = [];
  try {
    takenInvoiceNumbers = (await getInvoices()).map((invoice) => invoice.invoiceNo);
  } catch {
    takenInvoiceNumbers = [];
  }

  return (
    <AppShell>
      <InvoiceGenerator data={data} takenInvoiceNumbers={takenInvoiceNumbers} />
    </AppShell>
  );
}
