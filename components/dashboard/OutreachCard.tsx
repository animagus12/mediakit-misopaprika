import Link from "next/link";
import { Clock, MessageSquareDashed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { OutreachAlert } from "@/lib/outreach";

interface OutreachCardProps {
  alerts: OutreachAlert[];
  className?: string;
}

const MAX_ROWS = 4;

/**
 * Conversations that never became deals, and what to do about each.
 *
 * Kept apart from NeedsAttentionCard for the same reason AffiliateAlertsCard
 * is: that card is about deals on the books, and every row of it carries a
 * campaign and an amount. A pursuit has neither. It has a name, a silence, and
 * one decision, which is whether to send another message or stop.
 *
 * Only the rows worth acting on reach here. A brand holding a date it promised
 * is doing exactly what it should, and lib/outreach.ts leaves it out: a card
 * that lists things needing nothing is a card that stops being read.
 *
 * Renders nothing when nothing is waiting.
 */
export function OutreachCard({ alerts, className }: OutreachCardProps) {
  if (alerts.length === 0) return null;

  const shown = alerts.slice(0, MAX_ROWS);
  const hidden = alerts.length - shown.length;
  const toClose = alerts.filter((alert) => alert.state === "close").length;

  return (
    <Card className={cn("bg-rose-500/5 ring-rose-500/15", className)}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <MessageSquareDashed className="size-4 text-rose-600 dark:text-rose-400" />
          <CardDescription>Pipeline</CardDescription>
        </div>
        <CardTitle className="text-lg text-rose-600 dark:text-rose-400">
          {toClose > 0
            ? `${toClose} ready to close`
            : `${alerts.length} to chase`}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-0.5">
        {shown.map((alert) => (
          <Link
            key={`${alert.subjectKind}-${alert.subjectId}`}
            href={alert.href}
            className="flex items-start justify-between gap-3 rounded-md px-2 py-2 text-sm odd:bg-muted/30 hover:bg-muted/60"
          >
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 truncate font-medium">
                {alert.state === "overdue" && (
                  <Clock className="size-3 shrink-0 text-muted-foreground" />
                )}
                {alert.name}
              </p>
              <p className="truncate text-xs text-muted-foreground">{alert.label}</p>
            </div>
            <p className="shrink-0 pt-0.5 text-right text-xs text-muted-foreground">
              {alert.state === "close" ? "Close it" : "Follow up"}
            </p>
          </Link>
        ))}

        <div className="flex items-center justify-between gap-2 pt-1.5">
          {hidden > 0 ? (
            <p className="text-xs text-muted-foreground">+{hidden} more on the brands page</p>
          ) : (
            <span />
          )}
          <Button asChild size="sm" variant="outline">
            <Link href="/brands">Open brands</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
