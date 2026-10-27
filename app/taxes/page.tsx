import type { Metadata } from "next";
import AppShell from "@/components/common/AppShell";
import { FinancialYearFilter } from "@/components/common/FinancialYearFilter";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toSheetDate } from "@/lib/campaigns";
import { formatMoney } from "@/lib/invoice";
import { currentFinancialYearStart, financialYearLabel, resolveFinancialYearParam } from "@/lib/financialYear";
import { summarizeTds, tdsFinancialYears, type TdsSource } from "@/lib/tds";
import { campaignRepository } from "@/repositories/campaignRepository";
import type { Campaign } from "@/repositories/campaigns";

export const metadata: Metadata = {
  title: "TDS & tax - @misopaprika",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const SOURCE_LABELS: Record<TdsSource, string> = {
  deal: "Deal",
  renewal: "Usage renewal",
};

interface TaxesPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function TaxesPage({ searchParams }: TaxesPageProps) {
  const params = await searchParams;
  let campaigns: Campaign[] = [];
  let error: string | null = null;
  try {
    campaigns = await campaignRepository.getAll();
  } catch (err) {
    error = err instanceof Error ? err.message : "Something went wrong";
  }

  const years = tdsFinancialYears(campaigns);
  const selectedYear = resolveFinancialYearParam(params.fy, years) ?? currentFinancialYearStart();
  const summary = summarizeTds(campaigns, selectedYear);

  return (
    <AppShell>
      <div className="mx-auto max-w-screen-lg space-y-6 px-4 py-10 xl:max-w-6xl 2xl:max-w-[1440px]">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">TDS &amp; tax</h1>
          <p className="text-sm text-muted-foreground">
            Track tax withheld from brand payments, deals and usage renewals alike. Financial years run
            from April through March.
          </p>
        </div>

        {error && (
          <Card>
            <CardContent className="py-4 text-sm text-destructive">
              TDS records couldn&apos;t be loaded: {error}
            </CardContent>
          </Card>
        )}

        <FinancialYearFilter pathname="/taxes" searchParams={params} years={years} selected={selectedYear} />

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader>
              <CardDescription>TDS recorded · {financialYearLabel(selectedYear)}</CardDescription>
              <CardTitle className="tabular-nums">{formatMoney(summary.totalTds)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Payments with TDS records</CardDescription>
              <CardTitle className="tabular-nums">{summary.payments.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Gross amount with TDS</CardDescription>
              <CardTitle className="tabular-nums">{formatMoney(summary.totalCash)}</CardTitle>
              <p className="text-xs text-muted-foreground">
                Settled by the payments in the table below, before tax. Payments with no TDS recorded are left out.
              </p>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">By brand</CardTitle>
            <CardDescription>
              Total TDS recorded for each brand in {financialYearLabel(selectedYear)}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {summary.brands.length === 0 ? (
              <p className="text-sm text-muted-foreground">No TDS recorded for this financial year.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Brand</TableHead>
                    <TableHead className="text-right">Payments</TableHead>
                    <TableHead className="text-right">TDS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.brands.map((brand) => (
                    <TableRow key={brand.brand}>
                      <TableCell className="font-medium">{brand.brand}</TableCell>
                      <TableCell className="text-right tabular-nums">{brand.paymentCount}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(brand.tdsAmount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment details</CardTitle>
            <CardDescription>
              Each payment with TDS recorded, filed by the date the money arrived. A deal paid in
              instalments has a row for each. Estimates use the rate entered on that deal or renewal.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {summary.payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Record a payment with the TDS the brand withheld, or set a TDS rate on a deal already marked
                received, to see it here.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Paid on</TableHead>
                      <TableHead>Brand / campaign</TableHead>
                      <TableHead className="text-right">Gross amount</TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead className="text-right">TDS</TableHead>
                      <TableHead>Basis</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.payments.map((payment) => (
                      <TableRow key={payment.paymentId}>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {toSheetDate(payment.paidDate)}
                        </TableCell>
                        <TableCell>
                          <span className="block font-medium">{payment.brand}</span>
                          <span className="block text-xs text-muted-foreground">
                            {payment.campaign || "-"} · {SOURCE_LABELS[payment.source]}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoney(payment.cashAmount)}
                        </TableCell>
                        <TableCell>{payment.tdsRate === null ? "-" : `${payment.tdsRate}%`}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(payment.tdsAmount)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{payment.estimated ? "Estimated" : "Actual"}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          This is a tracking estimate, not a tax or refund calculation. Verify actual credits against your tax
          records and certificates before filing.
        </p>
      </div>
    </AppShell>
  );
}
