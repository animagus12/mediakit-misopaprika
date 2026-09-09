import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney } from "@/lib/invoice";
import { commissionVariancePercent, daysOverdue } from "@/lib/affiliates";
import { cn } from "@/lib/utils";
import type { AffiliatePartner } from "@/repositories/affiliatePartners";
import type { AffiliatePayout } from "@/repositories/affiliatePayouts";
import { DeletePayoutButton } from "./DeletePayoutButton";
import { EditPayoutSheet } from "./EditPayoutSheet";

// Beyond this, the gap between what the terms imply and what the brand paid
// is worth a second look rather than rounding. Brands net off returns, so a
// few points either way is normal and flagging it would be noise.
const VARIANCE_TOLERANCE = 5;

function periodLabel(payout: AffiliatePayout): string {
  return payout.periodStart && payout.periodEnd
    ? `${payout.periodStart} - ${payout.periodEnd}`
    : payout.periodEnd || payout.periodStart || "Unknown period";
}

interface AffiliatePayoutsTableProps {
  payouts: AffiliatePayout[];
  partners: AffiliatePartner[];
}

export function AffiliatePayoutsTable({ payouts, partners }: AffiliatePayoutsTableProps) {
  const byId = new Map(partners.map((partner) => [partner.id, partner]));

  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <Table className="min-w-[46rem]">
        <TableHeader>
          <TableRow>
            <TableHead>Partner</TableHead>
            <TableHead>Period</TableHead>
            <TableHead className="text-right">Gross sales</TableHead>
            <TableHead className="text-right">Orders</TableHead>
            <TableHead className="text-right">Commission</TableHead>
            <TableHead>Payment</TableHead>
            <TableHead className="w-16" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {payouts.map((payout) => {
            const partner = byId.get(payout.partnerId) ?? null;
            const variance = partner ? commissionVariancePercent(partner, payout) : null;
            const overdue = partner ? daysOverdue(partner, payout) : 0;
            const label = `${partner?.name ?? "Unknown"} ${periodLabel(payout)}`;

            return (
              <TableRow key={payout.id}>
                <TableCell className="font-medium">
                  {partner?.name ?? (
                    <span className="text-muted-foreground">Unknown partner</span>
                  )}
                  {partner && (
                    <span className="ml-1.5 font-mono text-[0.7rem] text-muted-foreground">
                      {partner.code}
                    </span>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {periodLabel(payout)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {payout.grossSales > 0 ? formatMoney(payout.grossSales) : "-"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {payout.salesCount > 0 ? payout.salesCount : "-"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(payout.commissionAmount)}
                  {/* Only a shortfall is called out. A brand paying more than
                      its own terms imply is not a problem to chase. */}
                  {variance !== null && variance < -VARIANCE_TOLERANCE && (
                    <span className="block text-[0.65rem] font-normal text-amber-600 dark:text-amber-400">
                      {variance.toFixed(0)}% vs terms
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {payout.paymentStatus === "received" ? (
                    <Badge
                      variant="outline"
                      className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
                    >
                      {payout.paidDate ? `Paid ${payout.paidDate}` : "Received"}
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className={cn(
                        "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
                        overdue > 0 &&
                          "border-destructive/30 bg-destructive/10 text-destructive dark:bg-destructive/15"
                      )}
                    >
                      {overdue > 0 ? `${overdue}d overdue` : "Pending"}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-0.5">
                    <EditPayoutSheet payout={payout} partners={partners}>
                      <button
                        type="button"
                        className="rounded-md px-2 py-1 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
                      >
                        Edit
                      </button>
                    </EditPayoutSheet>
                    <DeletePayoutButton id={payout.id} label={label} />
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
