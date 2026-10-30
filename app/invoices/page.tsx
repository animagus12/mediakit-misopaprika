import type { Metadata } from "next";
import AppShell from "@/components/common/AppShell";
import { InvoiceListSection } from "@/components/invoice/InvoiceListSection";
import { resolveFinancialYearParam } from "@/lib/financialYear";
import { invoiceFinancialYears } from "@/lib/invoice";
import { getInvoices } from "@/repositories/invoices.writer.server";
import type { Invoice } from "@/repositories/invoices";

export const metadata: Metadata = {
  title: "Invoices - @misopaprika",
  robots: { index: false, follow: false },
};

interface InvoicesPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function InvoicesPage({ searchParams }: InvoicesPageProps) {
  const params = await searchParams;
  let invoices: Invoice[] = [];
  let error: string | null = null;
  try {
    invoices = await getInvoices();
  } catch (err) {
    error = err instanceof Error ? err.message : "Something went wrong";
  }
  // No ?fy= (or one naming a year with no invoices) is the "All" view, so the
  // page reads exactly as it did before the filter existed.
  const financialYears = invoiceFinancialYears(invoices);
  const financialYear = resolveFinancialYearParam(params.fy, financialYears);

  return (
    <AppShell>
      <div className="mx-auto max-w-screen-lg xl:max-w-6xl 2xl:max-w-[1440px] space-y-8 px-4 py-10">
        <InvoiceListSection
          invoices={invoices}
          error={error}
          financialYear={financialYear}
          financialYears={financialYears}
          searchParams={params}
        />
      </div>
    </AppShell>
  );
}
