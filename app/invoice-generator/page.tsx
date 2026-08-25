import type { Metadata } from "next";
import AppShell from "@/components/common/AppShell";
import { InvoiceGenerator } from "@/components/invoice/InvoiceGenerator";
import { invoiceRepository } from "@/repositories/invoice";

export const metadata: Metadata = {
  title: "Invoice generator - @misopaprika",
  robots: { index: false, follow: false },
};

export default function InvoicePage() {
  const data = invoiceRepository.get();
  return (
    <AppShell>
      <InvoiceGenerator data={data} />
    </AppShell>
  );
}
