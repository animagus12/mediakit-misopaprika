import Link from "next/link";
import { BadgePercent, LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/invoice";
import { cn } from "@/lib/utils";
import type { AffiliateAlert } from "@/lib/affiliates";

interface AffiliateAlertsCardProps {
  alerts: AffiliateAlert[];
  className?: string;
}

const MAX_ROWS = 4;

/**
 * The one affiliate tile the dashboard carries, and deliberately not a stack.
 *
 * A pending commission is not an open loop: nothing is owed to anybody and
 * there is nothing to do about it, so it stays on /affiliates as a figure and
 * off this card. Two things do belong here, because both are actionable and
 * neither shows up anywhere else: a payout that has passed the arrival date
 * its own schedule promised, and a live code taking real traffic with no sale
 * recorded against it, which in practice means the tracking link is broken and
 * every click since has earned nothing.
 *
 * Kept apart from NeedsAttentionCard rather than folded into it: that card is
 * about deals, its rows carry a campaign and a per-row action, and an
 * affiliate alert has neither.
 *
 * Renders nothing when there is nothing to chase.
 */
export function AffiliateAlertsCard({ alerts, className }: AffiliateAlertsCardProps) {
  if (alerts.length === 0) return null;

  const shown = alerts.slice(0, MAX_ROWS);
  const hidden = alerts.length - shown.length;
  const owed = alerts
    .filter((alert) => alert.kind === "late-payout")
    .reduce((sum, alert) => sum + alert.amount, 0);

  return (
    <Card className={cn("bg-amber-500/5 ring-amber-500/15", className)}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <BadgePercent className="size-4 text-amber-600 dark:text-amber-400" />
          <CardDescription>Affiliates</CardDescription>
        </div>
        <CardTitle className="text-lg text-amber-600 dark:text-amber-400">
          {owed > 0
            ? `${formatMoney(owed)} past due`
            : `${alerts.length} code${alerts.length === 1 ? "" : "s"} to check`}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-0.5">
        {shown.map((alert) => (
          <div
            key={`${alert.kind}-${alert.payoutId ?? alert.partnerId}`}
            className="flex items-start justify-between gap-3 rounded-md px-2 py-2 text-sm odd:bg-muted/30"
          >
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 truncate font-medium">
                {alert.kind === "no-sales" && (
                  <LinkIcon className="size-3 shrink-0 text-muted-foreground" />
                )}
                {alert.partner}
              </p>
              <p className="truncate text-xs text-muted-foreground">{alert.label}</p>
            </div>
            {alert.amount > 0 && (
              <p className="shrink-0 pt-0.5 text-right text-xs tabular-nums text-muted-foreground">
                {formatMoney(alert.amount)}
              </p>
            )}
          </div>
        ))}

        <div className="flex items-center justify-between gap-2 pt-1.5">
          {hidden > 0 ? (
            <p className="text-xs text-muted-foreground">
              +{hidden} more on the affiliates page
            </p>
          ) : (
            <span />
          )}
          <Button asChild size="sm" variant="outline">
            <Link href="/affiliates">Open affiliates</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
