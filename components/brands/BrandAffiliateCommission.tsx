import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney } from "@/lib/invoice";
import { daysOverdue } from "@/lib/affiliates";
import { cn } from "@/lib/utils";
import type { AffiliatePartner } from "@/repositories/affiliatePartners";
import type { AffiliatePayout } from "@/repositories/affiliatePayouts";

export interface BrandAffiliateProgram {
  partner: AffiliatePartner;
  payouts: AffiliatePayout[]; // already scoped to this partner, newest period first
}

/**
 * Commission this brand has paid, on the brand's own payments tab.
 *
 * It sits below the deal payments rather than among them because it is a
 * different kind of obligation: a deal is invoiced once for an agreed figure,
 * a commission period is reported by the brand and settled on a schedule. But
 * it is money from the same brand, and a payments tab that omitted it would
 * understate the relationship.
 *
 * Renders nothing when this brand runs no affiliate program.
 */
export function BrandAffiliateCommission({ programs }: { programs: BrandAffiliateProgram[] }) {
  const withPayouts = programs.filter((program) => program.payouts.length > 0);
  if (withPayouts.length === 0) return null;

  const rows = withPayouts.flatMap((program) =>
    program.payouts.map((payout) => ({ partner: program.partner, payout }))
  );
  const received = rows
    .filter(({ payout }) => payout.paymentStatus === "received")
    .reduce((sum, { payout }) => sum + payout.commissionAmount, 0);
  const pending = rows
    .filter(({ payout }) => payout.paymentStatus !== "received")
    .reduce((sum, { payout }) => sum + payout.commissionAmount, 0);

  return (
    <Card>
      <CardHeader className="gap-1">
        <CardDescription>Affiliate commission</CardDescription>
        <p className="text-xs text-muted-foreground">
          {withPayouts.map((program) => program.partner.code).join(", ")} ·{" "}
          <span className="text-violet-600 dark:text-violet-400">{formatMoney(received)}</span>{" "}
          received
          {pending > 0 && (
            <>
              {", "}
              <span className="text-amber-600 dark:text-amber-400">{formatMoney(pending)}</span>{" "}
              pending
            </>
          )}
        </p>
      </CardHeader>
      <CardContent className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <Table className="min-w-[32rem]">
          <TableHeader>
            <TableRow>
              <TableHead>Period</TableHead>
              <TableHead className="text-right">Orders</TableHead>
              <TableHead className="text-right">Commission</TableHead>
              <TableHead>Payment</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ partner, payout }) => {
              const overdue = daysOverdue(partner, payout);
              return (
                <TableRow key={payout.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {payout.periodStart} - {payout.periodEnd}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {payout.salesCount > 0 ? payout.salesCount : "-"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(payout.commissionAmount)}
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
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
