"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  CircleSlash,
  FileText,
  PauseCircle,
  Percent,
  PlayCircle,
  RefreshCw,
  Unlink,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { raiseInvoiceForRenewal, setCampaignUsageState, unlinkRenewalInvoice } from "@/app/(dashboard)/actions";
import { PaymentHistory } from "@/components/payments/PaymentHistory";
import { buildInvoiceNumber, formatMoney } from "@/lib/invoice";
import { paymentStatusLabel } from "@/lib/campaigns";
import { resolveTds } from "@/lib/tds";
import { formatUsageDays, usageTerm, type UsageState } from "@/lib/usageRights";
import { cn } from "@/lib/utils";
import type { Campaign, UsageRenewal, UsageRenewalRecord } from "@/repositories/campaigns";
import { RenewUsageSheet } from "./RenewUsageSheet";
import { RenewalTdsSheet } from "./RenewalTdsSheet";

// Same vocabulary the campaigns table and the dashboard card use, so a
// licence looks the same wherever it is read.
const STATE_TONES: Record<UsageState, string> = {
  untracked: "text-muted-foreground",
  unstarted: "text-muted-foreground",
  active: "text-emerald-600 dark:text-emerald-400",
  indefinite: "text-emerald-600 dark:text-emerald-400",
  expiring: "text-amber-600 dark:text-amber-400",
  expired: "text-destructive",
  paused: "text-muted-foreground",
  ended: "text-muted-foreground",
};

function renewalStatusClass(renewal: UsageRenewal): string {
  if (renewal.settlement.status === "partial") {
    return "border-teal-500/30 bg-teal-500/10 text-teal-700 dark:bg-teal-500/15 dark:text-teal-400";
  }
  if (renewal.paymentStatus === "received") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400";
  }
  if (renewal.paymentStatus === "pending") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400";
  }
  return "";
}

// " · TDS ₹1,000" (or "≈ ₹1,000" while only the rate is known), "" when none.
// Once a payment is recorded against the renewal, the TDS those payments
// actually withheld.
function renewalTdsLabel(renewal: UsageRenewal): string {
  if (renewal.settlement.hasStored) {
    return renewal.settlement.tds > 0 ? ` · TDS ${formatMoney(renewal.settlement.tds)}` : "";
  }
  const tds = resolveTds(renewal.amount, renewal.tdsRate, renewal.tdsAmount);
  if (!tds) return "";
  return ` · TDS ${tds.estimated ? "≈ " : ""}${formatMoney(tds.amount)}`;
}

/**
 * The licence as it stands on one deal, and everything that has been bought
 * against it.
 *
 * The dashboard card only shows a licence during the weeks a decision is owed,
 * and only shows a renewal fee while it is unpaid, which is right for a
 * queue and wrong for a record: once either is dealt with it vanishes, and the
 * money a brand has paid to keep running a post would be visible nowhere. This
 * panel is that record, and it is on the deal because that is what a renewal
 * belongs to.
 *
 * Read-only except for moving the licence between its states and recording
 * what each renewal's brand paid (its Payments). Changing a renewal's terms
 * after the fact is deliberately absent: what was agreed was agreed, and a
 * mistake is corrected by recording a new renewal. The expected TDS rate is
 * the exception (see RenewalTdsSheet): it is often only learned later.
 */
export function UsageRightsPanel({ campaign }: { campaign: Campaign }) {
  const [isPending, startTransition] = useTransition();
  const term = usageTerm(campaign);
  const { renewals, status, indefinite } = campaign.usage;

  function move(transition: "pause" | "resume" | "end", message: string) {
    startTransition(async () => {
      const result = await setCampaignUsageState(campaign.id, transition);
      if (!result.success) {
        toast.error("Couldn't update the licence", { description: result.error });
        return;
      }
      toast.success(message);
    });
  }

  // The way back from a renewal with no invoice: one recorded before renewing
  // raised one, or one whose invoice failed to save at the time. Shown only on
  // those, so it cannot be mistaken for a way to raise a second.
  function raiseInvoice(renewal: UsageRenewalRecord) {
    startTransition(async () => {
      const result = await raiseInvoiceForRenewal(campaign.id, renewal.id);
      if (!result.success) {
        toast.error("Couldn't raise the invoice", { description: result.error });
        return;
      }
      toast.success(
        result.invoiceNo
          ? `Invoice ${buildInvoiceNumber(result.invoiceNo)} raised`
          : "Invoice raised"
      );
    });
  }

  // For a renewal pointing at an invoice that bills something else. Nothing is
  // deleted, and the renewal gets "Raise invoice" back.
  function unlinkInvoice(renewal: UsageRenewalRecord) {
    startTransition(async () => {
      const result = await unlinkRenewalInvoice(campaign.id, renewal.id);
      if (!result.success) {
        toast.error("Couldn't unlink the invoice", { description: result.error });
        return;
      }
      toast.success("Invoice unlinked from the renewal");
    });
  }

  if (term.state === "untracked") {
    return (
      <p className="text-[11px] text-muted-foreground">
        No licence recorded. Set a term above to start tracking it.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className={cn("text-sm font-medium", STATE_TONES[term.state])}>{term.label}</span>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {indefinite ? "Granted indefinitely" : `${formatUsageDays(term.totalDays)} granted`}
          {term.termCount > 1 ? ` over ${term.termCount} terms` : ""}
          {/* An ended licence already says when it ended; its term's nominal
              end beside that read as a second, contradicting end date. */}
          {term.endDate && status !== "ended" ? ` · ends ${term.endDate}` : ""}
        </span>
      </div>


      <div className="flex flex-wrap items-center gap-1.5">
        {/* Nothing to extend on a licence with no end, and no countdown for a
            pause to freeze. A pause recorded before it was made indefinite
            can still be resumed, so the licence isn't stuck reading paused. */}
        {!indefinite && (
          <RenewUsageSheet
            campaignId={campaign.id}
            brand={campaign.brand}
            term={term}
            defaultTdsRate={campaign.tdsRate}
            trigger={
              <Button type="button" size="sm" variant="outline" disabled={isPending}>
                <RefreshCw />
                Renew
              </Button>
            }
          />
        )}
        {indefinite && status !== "paused" ? null : status === "active" ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={isPending}
            onClick={() => move("pause", "Ad usage paused")}
          >
            <PauseCircle />
            Pause
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={isPending}
            onClick={() => move("resume", "Ad usage resumed")}
          >
            <PlayCircle />
            Resume
          </Button>
        )}
        {status !== "ended" && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={isPending}
            onClick={() => move("end", "Ad usage ended")}
          >
            <CircleSlash />
            End
          </Button>
        )}
      </div>

      {renewals.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] font-medium text-muted-foreground">Renewals</p>
          {renewals.map((renewal) => (
            <Collapsible key={renewal.id} className="rounded-md bg-muted/40 px-2 py-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0 text-xs">
                <p className="font-medium tabular-nums">
                  {formatUsageDays(renewal.days)} ·{" "}
                  {formatMoney(renewal.amount)}
                </p>
                <p className="text-[11px] text-muted-foreground tabular-nums">
                  from {renewal.startDate}
                  {renewal.paidDate ? ` · paid ${renewal.paidDate}` : ""}
                  {renewalTdsLabel(renewal)}
                </p>
                <div className="flex flex-wrap items-center gap-x-3">
                  {renewal.invoiceId && (
                    <span className="inline-flex items-center gap-1">
                      <Link
                        href={`/invoices/${renewal.invoiceId}`}
                        className="text-[11px] text-foreground hover:underline"
                      >
                        View invoice
                      </Link>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            size="icon-xs"
                            variant="ghost"
                            aria-label="Unlink renewal invoice"
                            disabled={isPending}
                            onClick={() => unlinkInvoice(renewal)}
                          >
                            <Unlink />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Unlink invoice</TooltipContent>
                      </Tooltip>
                    </span>
                  )}
                  {!renewal.invoiceId && renewal.amount > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-auto px-0 text-[11px] hover:bg-transparent hover:underline"
                      disabled={isPending}
                      onClick={() => raiseInvoice(renewal)}
                    >
                      <FileText />
                      Raise invoice
                    </Button>
                  )}
                  {renewal.amount > 0 && (
                    <RenewalTdsSheet
                      campaignId={campaign.id}
                      brand={campaign.brand}
                      renewal={renewal}
                      trigger={
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-auto px-0 text-[11px] hover:bg-transparent hover:underline"
                          disabled={isPending}
                        >
                          <Percent />
                          {renewal.tdsRate === null ? "Set TDS rate" : "Edit TDS rate"}
                        </Button>
                      }
                    />
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Badge variant="outline" className={renewalStatusClass(renewal)}>
                  {renewal.settlement.status === "partial"
                    ? "Partly paid"
                    : paymentStatusLabel(renewal.paymentStatus)}
                </Badge>
                {renewal.amount > 0 && (
                  <CollapsibleTrigger asChild>
                    <Button type="button" size="sm" variant="ghost" className="group/payments">
                      Payments
                      <ChevronDown className="transition group-data-[state=open]/payments:rotate-180" />
                    </Button>
                  </CollapsibleTrigger>
                )}
              </div>
            </div>
            {renewal.amount > 0 && (
              <CollapsibleContent className="pt-2">
                <PaymentHistory
                  settlement={renewal.settlement}
                  targetLabel={`${campaign.campaign.trim() || campaign.brand} · renewal ${renewal.id}`}
                  expectedTdsRate={renewal.tdsRate ?? campaign.tdsRate}
                  compact
                />
              </CollapsibleContent>
            )}
            </Collapsible>
          ))}
        </div>
      )}
    </div>
  );
}
