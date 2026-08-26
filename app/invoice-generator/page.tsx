import type { Metadata } from "next";
import AppShell from "@/components/common/AppShell";
import { InvoiceGenerator } from "@/components/invoice/InvoiceGenerator";
import { getInvoiceData } from "@/repositories/invoice.writer.server";

export const metadata: Metadata = {
  title: "Invoice generator - @misopaprika",
  robots: { index: false, follow: false },
};

export default async function InvoicePage() {
  const data = await getInvoiceData();
  return (
    <AppShell>
      <InvoiceGenerator data={data} />
    </AppShell>
  );
}
