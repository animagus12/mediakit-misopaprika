import type { Metadata } from "next";
import { InvoicePrintView } from "@/components/invoice/InvoicePrintView";

export const metadata: Metadata = {
  title: "Invoice PDF - @misopaprika",
  robots: { index: false, follow: false },
};

// Opened only by the PDF service's headless browser, which hands it the
// invoice to draw (services/printPdf.server.ts). Nothing to show otherwise.
export default function InvoicePrintPage() {
  return <InvoicePrintView />;
}
