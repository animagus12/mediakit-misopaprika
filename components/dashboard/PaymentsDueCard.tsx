"use client";

import Link from "next/link";
import { AlarmClock, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/invoice";
import { cn } from "@/lib/utils";
import { summarizeDuePayments, type DuePayment } from "@/lib/brandCampaignStats";
import type { CollectionLag } from "@/lib/cashTiming";
import { MarkReceivedButton } from "./MarkReceivedButton";
import { useMarkReceived } from "./useMarkReceived";

// A paid deal gets an invoice reference auto-assigned when added through the
// app; "" or "-" means nothing was ever raised, so the row offers a shortcut.
function needsInvoice(invoiceRef: string): boolean {
  const ref = invoiceRef.trim();
  return ref === "" || ref === "-";
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
  /**
   * How long payment has historically taken from the day a post went up.
   *
   * The rows below say when each payment is *promised*. This says when they
   * have actually turned up, which is the only thing that makes a due date
   * worth planning around, and it is a fact about the whole book rather than
   * about any one row.
   */
  lag: CollectionLag;
  className?: string;
}

// Action queue of brand-campaign payments still marked pending that carry a
// due date, each shown as a reverse timer ("Due in 3 days" / "Overdue by 2
// days"), most-overdue first, with per-row shortcuts to mark the payment
// received (optimistic, with Undo) or raise the missing invoice. Renders
// nothing when there's nothing owed on a schedule.
//
// Deals only. Licence renewal fees are a separate debt with their own row
// shape and their own collect action, and they are chased in the ad-usage card
// alongside the licence that produced them.
export function PaymentsDueCard({ due, lag, className }: PaymentsDueCardProps) {
  const { hiddenIds, isPending, markReceived } = useMarkReceived();

  const visible = due.filter(({ record }) => !hiddenIds.includes(record.campaignId));
  if (visible.length === 0) return null;

  // Summed over the visible rows, so marking one received optimistically
  // takes it out of the header as well as out of the list.
  const summary = summarizeDuePayments(visible);

  // Two independent facts, either of which can be missing: nothing may be due
  // inside the window, and a book that has never recorded the day a payment
  // landed has no lag to report. Joined only where both exist, so the line
  // never reads as a stray fragment after a separator.
  const aggregate = [
    summary.cashInWindow > 0
      ? `${formatMoney(summary.cashInWindow)} in cash lands within ${summary.windowDays} days`
      : null,
    lag.medianDays !== null
      ? `paid ~${lag.medianDays} day${lag.medianDays === 1 ? "" : "s"} after posting, across ${lag.sample} deal${lag.sample === 1 ? "" : "s"}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card className={cn("bg-amber-500/5 ring-amber-500/15", className)}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlarmClock className="size-4 text-amber-600 dark:text-amber-400" />
          <CardDescription>Payments due</CardDescription>
        </div>
        <CardTitle className="text-lg tabular-nums text-amber-600 dark:text-amber-400">
          {formatMoney(summary.outstanding)}
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {summary.count} payment{summary.count === 1 ? "" : "s"}
            {summary.overdueCount > 0 ? ` · ${summary.overdueCount} overdue` : ""}
          </span>
        </CardTitle>
        {/* The headline is what the deals are worth; this is what actually
            arrives and when. They differ by the barter value sitting in the
            pending deals, which is owed and is not money. */}
        {aggregate && <p className="text-[11px] text-muted-foreground">{aggregate}</p>}
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
                  {record.campaign || "-"} · {formatMoney(record.total)}
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
            {(record.campaignId || needsInvoice(record.invoiceRef)) && (
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {record.campaignId && (
                  <MarkReceivedButton
                    pending={isPending}
                    onClick={() => markReceived(record.campaignId, record.brand)}
                  />
                )}
                {needsInvoice(record.invoiceRef) && (
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
