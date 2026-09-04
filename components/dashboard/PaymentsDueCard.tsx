"use client";

import Link from "next/link";
import { AlarmClock, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/invoice";
import { cn } from "@/lib/utils";
import type { DuePayment } from "@/lib/brandCampaignStats";
import { MarkReceivedButton } from "./MarkReceivedButton";
import { useMarkReceived } from "./useMarkReceived";

// A paid deal gets an Invoice ID auto-assigned when added through the app;
// "" or "-" means nothing was ever raised, so the row offers a shortcut.
function needsInvoice(invoiceId: string): boolean {
  const id = invoiceId.trim();
  return id === "" || id === "-";
}

// Prefill the invoice editor with this deal's brand + campaign so the saved
// invoice lines up with the record.
function newInvoiceHref(brand: string, campaign: string): string {
  const params = new URLSearchParams();
  if (brand.trim()) params.set("client", brand.trim());
  if (campaign.trim()) params.set("campaign", campaign.trim());
  const query = params.toString();
  return query ? `/invoices/new?${query}` : "/invoices/new";
}

interface PaymentsDueCardProps {
  due: DuePayment[];
  className?: string;
}

// Action queue of brand-campaign payments still marked pending that carry a
// due date, each shown as a reverse timer ("Due in 3 days" / "Overdue by 2
// days"), most-overdue first, with per-row shortcuts to mark the payment
// received (optimistic, with Undo) or raise the missing invoice. Renders
// nothing when there's nothing owed on a schedule.
export function PaymentsDueCard({ due, className }: PaymentsDueCardProps) {
  const { hiddenIds, isPending, markReceived } = useMarkReceived();

  const visible = due.filter(({ record }) => !hiddenIds.includes(record.campaignId));
  if (visible.length === 0) return null;

  const outstanding = visible.reduce((sum, { record }) => sum + record.total, 0);
  const overdueCount = visible.filter(({ overdue }) => overdue).length;

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
            {visible.length} payment{visible.length === 1 ? "" : "s"}
            {overdueCount > 0 ? ` · ${overdueCount} overdue` : ""}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-0.5">
        {visible.map(({ record, dueDate, daysUntilDue, overdue, label }) => (
          <div
            key={record.campaignId || `${record.brand}-${dueDate}-${record.campaign}`}
            className="rounded-md px-2 py-2 text-sm odd:bg-muted/30"
          >
            <div className="flex items-start justify-between gap-3">
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
            {(record.campaignId || needsInvoice(record.invoiceId)) && (
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {record.campaignId && (
                  <MarkReceivedButton
                    pending={isPending}
                    onClick={() => markReceived(record.campaignId, record.brand)}
                  />
                )}
                {needsInvoice(record.invoiceId) && (
                  <Button asChild size="sm" variant="ghost">
                    <Link href={newInvoiceHref(record.brand, record.campaign)}>
                      <FileText />
                      Invoice
                    </Link>
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
