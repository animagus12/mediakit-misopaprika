import type { Metadata } from "next";
import AppShell from "@/components/common/AppShell";
import { InvoiceListSection } from "@/components/invoice/InvoiceListSection";
import { getInvoices } from "@/repositories/invoices.writer.server";
import type { Invoice } from "@/repositories/invoices";

export const metadata: Metadata = {
  title: "Invoices - @misopaprika",
  robots: { index: false, follow: false },
};

export default async function InvoicesPage() {
  let invoices: Invoice[] = [];
  let error: string | null = null;
  try {
    invoices = await getInvoices();
  } catch (err) {
    error = err instanceof Error ? err.message : "Something went wrong";
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-screen-lg xl:max-w-6xl 2xl:max-w-[1440px] space-y-8 px-4 py-10">
        <InvoiceListSection invoices={invoices} error={error} />
      </div>
    </AppShell>
  );
}
