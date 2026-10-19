import type { Metadata } from "next";
import Link from "next/link";
import AppShell from "@/components/common/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney } from "@/lib/invoice";
import { currentFinancialYearStart, summarizeTds, tdsFinancialYears } from "@/lib/tds";
import { campaignRepository } from "@/repositories/campaignRepository";
import type { Campaign } from "@/repositories/campaigns";

export const metadata: Metadata = {
  title: "TDS & tax - @misopaprika",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

interface TaxesPageProps {
  searchParams: Promise<{ fy?: string }>;
}

function financialYearLabel(start: number): string {
  return `FY ${start}-${String(start + 1).slice(-2)}`;
}

export default async function TaxesPage({ searchParams }: TaxesPageProps) {
  const { fy } = await searchParams;
  let campaigns: Campaign[] = [];
  let error: string | null = null;
  try {
    campaigns = await campaignRepository.getAll();
  } catch (err) {
    error = err instanceof Error ? err.message : "Something went wrong";
  }

  const years = tdsFinancialYears(campaigns);
  const requestedYear = fy && /^\d{4}$/.test(fy) ? Number(fy) : null;
  const selectedYear =
    requestedYear !== null && years.includes(requestedYear)
      ? requestedYear
      : currentFinancialYearStart();
  const summary = summarizeTds(campaigns, selectedYear);

  return (
    <AppShell>
      <div className="mx-auto max-w-screen-lg space-y-6 px-4 py-10 xl:max-w-6xl 2xl:max-w-[1440px]">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">TDS &amp; tax</h1>
          <p className="text-sm text-muted-foreground">
            Track tax withheld from brand payments. Financial years run from April through March.
          </p>
        </div>

        {error && (
          <Card>
            <CardContent className="py-4 text-sm text-destructive">
              TDS records couldn&apos;t be loaded: {error}
            </CardContent>
          </Card>
        )}

        <div className="flex flex-wrap gap-2">
          {years.map((year) => (
            <Button key={year} asChild variant={year === selectedYear ? "default" : "outline"} size="sm">
              <Link href={`/taxes?fy=${year}`}>{financialYearLabel(year)}</Link>
            </Button>
          ))}
        </div>

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
              <CardDescription>Gross campaign value</CardDescription>
              <CardTitle className="tabular-nums">{formatMoney(summary.totalCash)}</CardTitle>
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
              TDS is grouped by the campaign payment date. Estimates use the rate entered on the campaign.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {summary.payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Mark a campaign payment as received and enter its TDS details to see it here.
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
                      <TableHead>Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.payments.map((payment) => (
                      <TableRow key={payment.campaignId}>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {payment.paidDate}
                        </TableCell>
                        <TableCell>
                          <span className="block font-medium">{payment.brand}</span>
                          <span className="block text-xs text-muted-foreground">{payment.campaign}</span>
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
