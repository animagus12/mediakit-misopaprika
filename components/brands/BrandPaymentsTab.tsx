import type { VariantProps } from "class-variance-authority";
import { Badge, type badgeVariants } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { findInvoiceByCampaignInvoiceId, formatMoney, invoicePaymentMismatch } from "@/lib/invoice";
import { cn } from "@/lib/utils";
import type { BrandCampaignPaymentStatus, BrandCampaignRecord } from "@/repositories/brandCampaigns";
import type { BrandStats } from "@/lib/brandCampaignStats";
import type { Invoice } from "@/repositories/invoices";

const STAT_TONES = {
  neutral: { card: "", value: "" },
  cash: { card: "bg-emerald-500/5 ring-emerald-500/15", value: "text-emerald-600 dark:text-emerald-400" },
  amber: { card: "bg-amber-500/5 ring-amber-500/15", value: "text-amber-600 dark:text-amber-400" },
} as const;

interface StatusStyle {
  variant: VariantProps<typeof badgeVariants>["variant"];
  className?: string;
}

function paymentStatusStyle(status: BrandCampaignPaymentStatus): StatusStyle {
  switch (status) {
    case "received":
      return {
        variant: "outline",
        className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
      };
    case "pending":
      return {
        variant: "outline",
        className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
      };
    default:
      return { variant: "secondary" };
  }
}

interface BrandPaymentsTabProps {
  stats: BrandStats;
  records: BrandCampaignRecord[];
  invoices: Invoice[]; // this brand's saved invoices, for reconciling each record's Invoice ID field
}

export function BrandPaymentsTab({ stats, records, invoices }: BrandPaymentsTabProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card className={STAT_TONES.neutral.card}>
          <CardHeader>
            <CardDescription>Total billed</CardDescription>
            <CardTitle className={cn("text-base tabular-nums", STAT_TONES.neutral.value)}>
              {formatMoney(stats.totalBilled)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className={STAT_TONES.cash.card}>
          <CardHeader>
            <CardDescription>Total received</CardDescription>
            <CardTitle className={cn("text-base tabular-nums", STAT_TONES.cash.value)}>
              {formatMoney(stats.totalReceived)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className={STAT_TONES.amber.card}>
          <CardHeader>
            <CardDescription>Pending</CardDescription>
            <CardTitle className={cn("text-base tabular-nums", STAT_TONES.amber.value)}>
              {formatMoney(stats.pending)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {records.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-xs text-muted-foreground">No payment history yet.</CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead>Campaign</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Method</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record) => {
                const status = paymentStatusStyle(record.paymentStatus);
                const matchedInvoice = findInvoiceByCampaignInvoiceId(record.invoiceId, invoices);
                const mismatch = matchedInvoice
                  ? invoicePaymentMismatch(record.paymentStatus, matchedInvoice.status)
                  : null;
                return (
                  <TableRow key={record.campaignId || `${record.campaign}-${record.date}`}>
                    <TableCell className="max-w-40 truncate font-medium">{record.campaign || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {matchedInvoice ? (
                        <Link href={`/invoices/${matchedInvoice.id}`} className="text-foreground hover:underline">
                          {record.invoiceId}
                        </Link>
                      ) : (
                        record.invoiceId || "—"
                      )}
                      {mismatch && (
                        <span className="block text-[11px] text-amber-600 dark:text-amber-400">{mismatch}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(record.total)}</TableCell>
                    <TableCell>
                      <Badge variant={status.variant} className={status.className}>
                        {record.paymentStatus === "unknown" ? "—" : record.paymentStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{record.paymentMethod || "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
