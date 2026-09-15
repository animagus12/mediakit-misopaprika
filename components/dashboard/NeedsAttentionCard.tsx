"use client";

import Link from "next/link";
import { Check, CircleAlert, FileText } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatMoney, newInvoiceHref } from "@/lib/invoice";
import { cn } from "@/lib/utils";
import type { AttentionItem } from "@/lib/dashboardAttention";
import { useMarkReceived } from "./useMarkReceived";

interface NeedsAttentionCardProps {
  items: AttentionItem[];
  className?: string;
}

const MAX_ROWS = 6;

// Operational open loops: delivered work with no invoice, posted deals
// with untracked payment: each with the one action that closes it. Sits
// next to PaymentsDueCard (money owed on a schedule); nothing here carries a
// due date, so the two lists don't overlap. Renders nothing when clear.
export function NeedsAttentionCard({ items, className }: NeedsAttentionCardProps) {
  const { hiddenIds, isPending, markReceived } = useMarkReceived();

  const visible = items.filter((item) => !hiddenIds.includes(item.campaignId));
  if (visible.length === 0) return null;

  const shown = visible.slice(0, MAX_ROWS);
  const hidden = visible.length - shown.length;

  return (
    <Card className={cn("bg-rose-500/5 ring-rose-500/15", className)}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CircleAlert className="size-4 text-rose-600 dark:text-rose-400" />
          <CardDescription>Needs attention</CardDescription>
        </div>
        <CardTitle className="text-lg text-rose-600 dark:text-rose-400">
          {visible.length} thing{visible.length === 1 ? "" : "s"} to follow up
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-0.5">
        {shown.map((item) => (
          // One line per loop with its action at the end, the same row the
          // payments card uses, rather than a line of buttons under each.
          <div
            key={`${item.kind}-${item.campaignId || `${item.brand}-${item.campaign}`}`}
            className="flex items-center gap-3 rounded-md px-2 py-1.5 text-sm odd:bg-muted/30"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{item.brand}</p>
              <p className="flex min-w-0 gap-1 text-xs text-muted-foreground">
                <span className="truncate">{item.campaign || "-"}</span>
                <span className="shrink-0 tabular-nums">· {formatMoney(item.amount)}</span>
              </p>
            </div>
            <p className="shrink-0 text-right text-xs text-muted-foreground">{item.label}</p>
            <div className="flex min-w-6 shrink-0 justify-end pointer-coarse:min-w-11">
              <AttentionAction item={item} isPending={isPending} onMarkReceived={markReceived} />
            </div>
          </div>
        ))}
        {hidden > 0 && (
          <p className="px-2 pt-1 text-xs text-muted-foreground">
            +{hidden} more need{hidden === 1 ? "s" : ""} attention
          </p>
        )}
      </CardContent>
    </Card>
  );
}

interface AttentionActionProps {
  item: AttentionItem;
  isPending: boolean;
  onMarkReceived: (campaignId: string, brand: string) => void;
}

// The one action that closes the loop, as an icon button with its name on
// hover. Styled with buttonVariants on the trigger rather than wrapping
// <Button>, which fails to server render (see PaymentsDueCard).
function AttentionAction({ item, isPending, onMarkReceived }: AttentionActionProps) {
  const link =
    item.kind === "uninvoiced"
      ? { href: newInvoiceHref(item.brand, item.campaign, item.campaignId), label: "Create invoice" }
      : item.kind === "overdue-invoice"
        ? { href: `/invoices/${item.campaignId}`, label: "View invoice" }
        : null;

  if (link) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={link.href}
            aria-label={link.label}
            className={buttonVariants({ variant: "outline", size: "icon-sm" })}
          >
            <FileText />
          </Link>
        </TooltipTrigger>
        <TooltipContent side="left">{link.label}</TooltipContent>
      </Tooltip>
    );
  }
  if (!item.campaignId) return null;
  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        aria-label="Mark received"
        disabled={isPending}
        onClick={() => onMarkReceived(item.campaignId, item.brand)}
        className={buttonVariants({ variant: "outline", size: "icon-sm" })}
      >
        <Check />
      </TooltipTrigger>
      <TooltipContent side="left">Mark received</TooltipContent>
    </Tooltip>
  );
}
