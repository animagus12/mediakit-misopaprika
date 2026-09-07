"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import {
  Check,
  CircleSlash,
  FileText,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  Undo2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  raiseInvoiceForRenewal,
  setCampaignUsageState,
  setUsageRenewalPaymentStatus,
} from "@/app/(dashboard)/actions";
import { buildInvoiceNumber, formatMoney } from "@/lib/invoice";
import { paymentStatusLabel } from "@/lib/campaigns";
import { usageTerm, type UsageState } from "@/lib/usageRights";
import { cn } from "@/lib/utils";
import type { Campaign, UsageRenewalRecord } from "@/repositories/campaigns";
import { RenewUsageSheet } from "./RenewUsageSheet";

// Same vocabulary the campaigns table and the dashboard card use, so a
// licence looks the same wherever it is read.
const STATE_TONES: Record<UsageState, string> = {
  untracked: "text-muted-foreground",
  unstarted: "text-muted-foreground",
  active: "text-emerald-600 dark:text-emerald-400",
  expiring: "text-amber-600 dark:text-amber-400",
  expired: "text-destructive",
  paused: "text-muted-foreground",
  ended: "text-muted-foreground",
};

function renewalStatusClass(renewal: UsageRenewalRecord): string {
  if (renewal.paymentStatus === "received") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400";
  }
  if (renewal.paymentStatus === "pending") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400";
  }
  return "";
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
 * Read-only except for the two things that are genuinely one click: moving the
 * licence between its states, and collecting a fee. Changing a renewal's terms
 * after the fact is deliberately absent: what was agreed was agreed, and a
 * mistake is corrected by recording a new renewal.
 */
export function UsageRightsPanel({ campaign }: { campaign: Campaign }) {
  const [isPending, startTransition] = useTransition();
  const term = usageTerm(campaign);
  const { renewals, status } = campaign.usage;

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

  function setRenewalPaid(renewal: UsageRenewalRecord, received: boolean) {
    startTransition(async () => {
      const result = await setUsageRenewalPaymentStatus(
        campaign.id,
        renewal.id,
        received ? "received" : "pending"
      );
      if (!result.success) {
        toast.error("Couldn't update the renewal payment", { description: result.error });
        return;
      }
      toast.success(received ? "Renewal marked received" : "Renewal put back to pending");
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
          {term.totalMonths} month{term.totalMonths === 1 ? "" : "s"} granted
          {term.termCount > 1 ? ` over ${term.termCount} terms` : ""}
          {term.endDate ? ` · ends ${term.endDate}` : ""}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <RenewUsageSheet
          campaignId={campaign.id}
          brand={campaign.brand}
          term={term}
          trigger={
            <Button type="button" size="sm" variant="outline" disabled={isPending}>
              <RefreshCw />
              Renew
            </Button>
          }
        />
        {status === "active" ? (
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
            <div
              key={renewal.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 px-2 py-1.5"
            >
              <div className="min-w-0 text-xs">
                <p className="font-medium tabular-nums">
                  {renewal.months} month{renewal.months === 1 ? "" : "s"} ·{" "}
                  {formatMoney(renewal.amount)}
                </p>
                <p className="text-[11px] text-muted-foreground tabular-nums">
                  from {renewal.startDate}
                  {renewal.paidDate ? ` · paid ${renewal.paidDate}` : ""}
                </p>
                {renewal.invoiceId && (
                  <Link
                    href={`/invoices/${renewal.invoiceId}`}
                    className="text-[11px] text-foreground hover:underline"
                  >
                    View invoice
                  </Link>
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
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Badge variant="outline" className={renewalStatusClass(renewal)}>
                  {paymentStatusLabel(renewal.paymentStatus)}
                </Badge>
                {renewal.amount > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={isPending}
                    onClick={() =>
                      setRenewalPaid(renewal, renewal.paymentStatus !== "received")
                    }
                  >
                    {renewal.paymentStatus === "received" ? <Undo2 /> : <Check />}
                    {renewal.paymentStatus === "received" ? "Revert" : "Mark paid"}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
