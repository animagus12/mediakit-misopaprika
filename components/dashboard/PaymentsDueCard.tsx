"use client";

import { useState } from "react";
import Link from "next/link";
import { AlarmClock, Check, ChevronDown, FileText } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatMoney, newInvoiceHref } from "@/lib/invoice";
import { cn } from "@/lib/utils";
import { summarizeDuePayments, type DuePayment } from "@/lib/brandCampaignStats";
import type { CollectionLag } from "@/lib/cashTiming";
import { useMarkReceived } from "./useMarkReceived";

// Enough to see what is overdue and what lands next; the rest fold away
// behind "Show N more" so a long book doesn't push the dashboard down.
const MAX_ROWS = 5;

// A paid deal gets an invoice reference auto-assigned when added through the
// app; "" or "-" means nothing was ever raised, so the row offers a shortcut.
function needsInvoice(invoiceRef: string): boolean {
  const ref = invoiceRef.trim();
  return ref === "" || ref === "-";
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

  const [expanded, setExpanded] = useState(false);

  const visible = due.filter(({ record }) => !hiddenIds.includes(record.campaignId));
  if (visible.length === 0) return null;

  // Most overdue first, so the rows folded away are the ones due furthest out.
  const shown = visible.slice(0, MAX_ROWS);
  const rest = visible.slice(MAX_ROWS);
  const rowActions = { isPending, onMarkReceived: markReceived };

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
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <CardContent className="space-y-0.5">
          {shown.map((payment, index) => (
            <DuePaymentRow key={rowKey(payment)} payment={payment} striped={index % 2 === 0} {...rowActions} />
          ))}
          {rest.length > 0 && (
            <>
              <CollapsibleContent className="space-y-0.5">
                {rest.map((payment, index) => (
                  <DuePaymentRow
                    key={rowKey(payment)}
                    payment={payment}
                    striped={(shown.length + index) % 2 === 0}
                    {...rowActions}
                  />
                ))}
              </CollapsibleContent>
              <CollapsibleTrigger asChild>
                <Button type="button" size="sm" variant="ghost" className="w-full text-muted-foreground">
                  {expanded ? "Show less" : `Show ${rest.length} more`}
                  <ChevronDown className={cn("transition-transform", expanded && "rotate-180")} />
                </Button>
              </CollapsibleTrigger>
            </>
          )}
        </CardContent>
      </Collapsible>
    </Card>
  );
}

function rowKey({ record, dueDate }: DuePayment): string {
  return record.campaignId || `${record.brand}-${dueDate}-${record.campaign}`;
}

interface DuePaymentRowProps {
  payment: DuePayment;
  /** Striped by position in the whole list, since the rows sit in two parents. */
  striped: boolean;
  isPending: boolean;
  onMarkReceived: (campaignId: string, brand: string) => void;
}

// One line of the queue. The actions are icon buttons at the row's end rather
// than a row of their own, which is what made four payments take a screen.
function DuePaymentRow({ payment, striped, isPending, onMarkReceived }: DuePaymentRowProps) {
  const { record, dueDate, daysUntilDue, overdue, label } = payment;
  return (
    <div className={cn("flex items-center gap-3 rounded-md px-2 py-1.5 text-sm", striped && "bg-muted/30")}>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{record.brand}</p>
        {/* Only the campaign name gives way on a narrow row; the amount is
            the half of this line worth reading. */}
        <p className="flex min-w-0 gap-1 text-xs text-muted-foreground">
          <span className="truncate">{record.campaign || "-"}</span>
          <span className="shrink-0 tabular-nums">· {formatMoney(record.total)}</span>
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
      {/* Two buttons wide, so the due column lines up whether a row has one
          action or two; icon-sm grows to 44px on touch screens. Tooltips open
          left: the card clips anything that pops out past its edge.

          The triggers are styled with buttonVariants rather than wrapping
          <Button>: a TooltipTrigger slotted onto <Button> fails to server
          render ("Primitive.button failed to slot onto its children"), which
          throws the whole payments boundary over to client rendering. */}
      <div className="flex min-w-13 shrink-0 items-center justify-end gap-1 pointer-coarse:min-w-23">
        {needsInvoice(record.invoiceRef) && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href={newInvoiceHref(record.brand, record.campaign, record.campaignId)}
                aria-label="Create invoice"
                className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
              >
                <FileText />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="left">Create invoice</TooltipContent>
          </Tooltip>
        )}
        {record.campaignId && (
          <Tooltip>
            <TooltipTrigger
              type="button"
              aria-label="Mark received"
              disabled={isPending}
              onClick={() => onMarkReceived(record.campaignId, record.brand)}
              className={buttonVariants({ variant: "outline", size: "icon-sm" })}
            >
              <Check />
            </TooltipTrigger>
            <TooltipContent side="left">Mark received</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
