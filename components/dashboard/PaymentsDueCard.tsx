import { AlarmClock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/invoice";
import { cn } from "@/lib/utils";
import type { DuePayment } from "@/lib/brandCampaignStats";

interface PaymentsDueCardProps {
  due: DuePayment[];
  className?: string;
}

// At-a-glance reminder feed of brand-campaign payments still marked pending
// that carry a due date, each shown as a reverse timer ("Due in 3 days" /
// "Overdue by 2 days"), most-overdue first. Renders nothing when there's
// nothing owed on a schedule.
export function PaymentsDueCard({ due, className }: PaymentsDueCardProps) {
  if (due.length === 0) return null;

  const outstanding = due.reduce((sum, { record }) => sum + record.total, 0);
  const overdueCount = due.filter(({ overdue }) => overdue).length;

  return (
    <Card className={cn("bg-amber-500/5 ring-amber-500/15", className)}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlarmClock className="size-4 text-amber-600 dark:text-amber-400" />
          <CardDescription>Payments due</CardDescription>
        </div>
        <CardTitle className="text-lg tabular-nums text-amber-600 dark:text-amber-400">
          {formatMoney(outstanding)}
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {due.length} payment{due.length === 1 ? "" : "s"}
            {overdueCount > 0 ? ` · ${overdueCount} overdue` : ""}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-0.5">
        {due.map(({ record, dueDate, daysUntilDue, overdue, label }) => (
          <div
            key={record.campaignId || `${record.brand}-${dueDate}-${record.campaign}`}
            className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm odd:bg-muted/30"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{record.brand}</p>
              <p className="truncate text-xs text-muted-foreground">
                {record.campaign || "—"} · {formatMoney(record.total)}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p
                className={cn(
                  "font-medium tabular-nums",
                  overdue
                    ? "text-destructive"
                    : daysUntilDue <= 3
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-muted-foreground"
                )}
              >
                {label}
              </p>
              <p className="text-xs text-muted-foreground tabular-nums">{dueDate}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
