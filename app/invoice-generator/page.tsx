import type { Metadata } from "next";
import { InvoiceGenerator } from "@/components/invoice/InvoiceGenerator";
import { invoiceRepository } from "@/repositories/invoice";

export const metadata: Metadata = {
  title: "Invoice generator — @misopaprika",
  robots: { index: false, follow: false },
};

export default function InvoicePage() {
  const data = invoiceRepository.get();
  return <InvoiceGenerator data={data} />;
}
