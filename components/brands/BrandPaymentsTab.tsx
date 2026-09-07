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
import {
  buildInvoiceNumber,
  findInvoiceByCampaignInvoiceId,
  formatMoney,
  invoicePaymentMismatch,
} from "@/lib/invoice";
import {
  computePaymentReliability,
  paymentTiming,
  RELIABILITY_RATING_LABELS,
  type PaymentPunctuality,
  type PaymentReliability,
  type ReliabilityRating,
} from "@/lib/paymentReliability";
import { cn } from "@/lib/utils";
import type { BrandCampaignPaymentStatus, BrandCampaignRecord } from "@/repositories/brandCampaigns";
import { selectBrandPaymentRows, type BrandStats } from "@/lib/brandCampaignStats";
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

// The verdict's own colour, so the tile can be read before the words are.
// Raw palette hues at low opacity, following the destructive-variant
// convention the app already uses: globals.css has no success token.
const RATING_TONES: Record<ReliabilityRating, { card: string; value: string }> = {
  reliable: {
    card: "bg-emerald-500/5 ring-emerald-500/15",
    value: "text-emerald-600 dark:text-emerald-400",
  },
  "mostly-reliable": {
    card: "bg-emerald-500/5 ring-emerald-500/15",
    value: "text-emerald-600 dark:text-emerald-400",
  },
  slow: { card: "bg-amber-500/5 ring-amber-500/15", value: "text-amber-600 dark:text-amber-400" },
  unreliable: { card: "bg-destructive/5 ring-destructive/15", value: "text-destructive" },
  unrated: { card: "", value: "text-muted-foreground" },
};

const TIMING_TONES: Record<PaymentPunctuality, string> = {
  early: "text-emerald-600 dark:text-emerald-400",
  "on-time": "text-emerald-600 dark:text-emerald-400",
  late: "text-amber-600 dark:text-amber-400",
  overdue: "text-destructive",
  waiting: "text-muted-foreground",
  untimed: "text-muted-foreground",
};

/**
 * What this brand's payment history says about whether it can be relied on.
 *
 * The score is never shown on its own. A number without its sample size is a
 * claim rather than evidence, and the line underneath is what makes the tile
 * arguable: how many payments it counted, how many landed on time, and how bad
 * the worst one was.
 */
function ReliabilityCard({ reliability }: { reliability: PaymentReliability }) {
  const tone = RATING_TONES[reliability.rating];
  const facts = [
    `${reliability.onTime}/${reliability.sample} on time`,
    reliability.worstDelayDays && reliability.worstDelayDays > 0
      ? `worst ${reliability.worstDelayDays} days`
      : null,
    reliability.overdueAmount > 0 ? `${formatMoney(reliability.overdueAmount)} overdue` : null,
  ].filter(Boolean);

  return (
    <Card className={tone.card}>
      <CardHeader>
        <CardDescription>Payment reliability</CardDescription>
        <CardTitle className={cn("text-base", tone.value)}>
          {RELIABILITY_RATING_LABELS[reliability.rating]}
          {reliability.score !== null && (
            <span className="ml-2 text-xs font-normal tabular-nums text-muted-foreground">
              {reliability.score}/100
            </span>
          )}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{reliability.label}</p>
        {reliability.sample > 0 ? (
          <p className="text-[11px] text-muted-foreground">{facts.join(" · ")}</p>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            Needs a payment due date and the day it landed, on at least one paid deal.
          </p>
        )}
      </CardHeader>
    </Card>
  );
}

interface BrandPaymentsTabProps {
  stats: BrandStats;
  records: BrandCampaignRecord[];
  invoices: Invoice[]; // this brand's saved invoices, for reconciling each record's Invoice ID field
}

export function BrandPaymentsTab({ stats, records, invoices }: BrandPaymentsTabProps) {
  // Rows first, verdict from the rows: renewals are money owed on a schedule
  // like any other, so they belong in both or neither.
  const rows = selectBrandPaymentRows(records);
  const reliability = computePaymentReliability(rows);

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

      <div
        className={cn(
          "grid gap-4",
          // The renewal tile appears only once there is a renewal to report: a
          // permanent "no renewals" tile on every brand would be noise on all
          // of them to serve the few that licence their content.
          stats.renewalCount > 0 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"
        )}
      >
        <ReliabilityCard reliability={reliability} />
        {stats.renewalCount > 0 && (
          <Card className={STAT_TONES.cash.card}>
            <CardHeader>
              <CardDescription>Ad usage renewals</CardDescription>
              <CardTitle className={cn("text-base tabular-nums", STAT_TONES.cash.value)}>
                {formatMoney(stats.renewalReceived)}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {stats.renewalCount} renewal{stats.renewalCount === 1 ? "" : "s"}
                {stats.renewalPending > 0
                  ? ` · ${formatMoney(stats.renewalPending)} still owed`
                  : ""}
              </p>
            </CardHeader>
          </Card>
        )}
      </div>

      {rows.length === 0 ? (
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
                <TableHead>Paid on</TableHead>
                <TableHead>Method</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const status = paymentStatusStyle(row.paymentStatus);
                // A deal names its invoice in free text and has to be matched
                // back by number; a renewal was written alongside its invoice
                // and carries the real id, so it is looked up directly.
                const matchedInvoice = row.record
                  ? findInvoiceByCampaignInvoiceId(row.invoiceRef, invoices)
                  : (invoices.find((invoice) => invoice.id === row.invoiceId) ?? null);
                // Checked on renewals as well as deals: a renewal's invoice is
                // kept in step by the action that collects it, so a
                // disagreement here means someone moved one side by hand,
                // which is precisely what this warning is for.
                const mismatch = matchedInvoice
                  ? invoicePaymentMismatch(row.paymentStatus, matchedInvoice.status)
                  : null;
                const timing = paymentTiming(row);
                return (
                  <TableRow key={row.key}>
                    <TableCell
                      className={cn(
                        "max-w-40 truncate",
                        // A renewal reads as a continuation of the row above
                        // it, not as another deal, so it is indented and left
                        // unbolded rather than given a badge of its own.
                        row.kind === "renewal" ? "pl-6 text-muted-foreground" : "font-medium"
                      )}
                      title={row.label}
                    >
                      {row.label}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {matchedInvoice ? (
                        <Link
                          href={`/invoices/${matchedInvoice.id}`}
                          className="text-foreground hover:underline"
                        >
                          {buildInvoiceNumber(matchedInvoice.invoiceNo)}
                        </Link>
                      ) : (
                        row.invoiceRef || "-"
                      )}
                      {mismatch && (
                        <span className="block text-[11px] text-amber-600 dark:text-amber-400">{mismatch}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(row.amount)}</TableCell>
                    <TableCell>
                      <Badge variant={status.variant} className={status.className}>
                        {row.paymentStatus === "unknown" ? "-" : row.paymentStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.paidDate || "-"}
                      {timing.label && (
                        <span className={cn("block text-[11px]", TIMING_TONES[timing.punctuality])}>
                          {timing.label}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{row.paymentMethod || "-"}</TableCell>
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
