"use client";

import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { renewCampaignUsage } from "@/app/(dashboard)/actions";
import { PAYMENT_STATUS_OPTIONS, paymentStatusLabel } from "@/lib/campaigns";
import { buildInvoiceNumber } from "@/lib/invoice";
import { defaultRenewalStart, type UsageTerm } from "@/lib/usageRights";
import type { CampaignPaymentStatus } from "@/repositories/campaigns";

interface RenewFormState {
  months: string;
  amount: string;
  startDate: string;
  paymentStatus: CampaignPaymentStatus;
  paymentDue: string;
  paidDate: string;
  paymentMethod: string;
}

// Three months is the term most licences are written for, so it is what the
// field opens on; the amount deliberately is not guessed from the deal, since
// a renewal is negotiated separately and a prefilled price is one nobody
// re-reads before saving.
function initialForm(term: UsageTerm): RenewFormState {
  return {
    months: "3",
    amount: "",
    startDate: defaultRenewalStart(term),
    paymentStatus: "pending",
    paymentDue: "",
    paidDate: "",
    paymentMethod: "",
  };
}

interface RenewUsageSheetProps {
  campaignId: string;
  brand: string;
  term: UsageTerm;
  trigger: ReactNode;
  /** Fired once the renewal is saved, so a list can drop the row it came from. */
  onRenewed?: () => void;
}

/**
 * Buys another term on a licence, and records what the brand paid for it.
 *
 * A sheet rather than an inline control because a renewal is a transaction:
 * it has a price, a payment status, a due date and a method, and squeezing
 * that into a row in an alert list would either lose fields or make the row
 * unreadable. The same reason the deal itself is edited in one.
 */
export function RenewUsageSheet({
  campaignId,
  brand,
  term,
  trigger,
  onRenewed,
}: RenewUsageSheetProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<RenewFormState>(() => initialForm(term));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const formId = `renew-usage-${campaignId}`;
  const months = Number(form.months) || 0;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await renewCampaignUsage(campaignId, {
        startDate: form.startDate,
        months,
        amount: Number(form.amount) || 0,
        paymentStatus: form.paymentStatus,
        paymentDue: form.paymentDue,
        paidDate: form.paidDate,
        paymentMethod: form.paymentMethod.trim(),
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setOpen(false);
      onRenewed?.();

      const term = `${months} more month${months === 1 ? "" : "s"}`;
      if (result.warning) {
        // The renewal landed either way; the warning is about the invoice not
        // following, which is worth saying rather than showing a plain success.
        toast.warning(`${brand}: usage renewed`, {
          description: `${term}. The invoice wasn't raised: ${result.warning}`,
        });
        return;
      }
      toast.success(`${brand}: usage renewed`, {
        description: result.invoiceNo
          ? `${term}. Invoice ${buildInvoiceNumber(result.invoiceNo)} raised as a draft.`
          : `${term}. No invoice raised: nothing was charged.`,
      });
    });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Reseeded on open rather than in an effect: the start date is derived
        // from a term that keeps moving, so a form built once would offer a
        // stale date the longer the page stayed open.
        if (next) {
          setForm(initialForm(term));
          setError(null);
        }
      }}
    >
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="flex flex-col gap-0">
        <SheetHeader>
          <SheetTitle>Renew ad usage</SheetTitle>
          <SheetDescription>
            Extends {brand}&apos;s licence by another term and records what they paid for it.
          </SheetDescription>
        </SheetHeader>

        <form id={formId} onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto px-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor={`${formId}-months`}>Months</Label>
              <Input
                id={`${formId}-months`}
                type="number"
                min={1}
                step={1}
                required
                value={form.months}
                onChange={(event) => setForm((f) => ({ ...f, months: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${formId}-amount`}>Amount (₹)</Label>
              <Input
                id={`${formId}-amount`}
                type="number"
                min={0}
                placeholder="0"
                value={form.amount}
                onChange={(event) => setForm((f) => ({ ...f, amount: event.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${formId}-startDate`}>Runs from</Label>
            <Input
              id={`${formId}-startDate`}
              type="date"
              required
              value={form.startDate}
              onChange={(event) => setForm((f) => ({ ...f, startDate: event.target.value }))}
            />
            <p className="text-[11px] text-muted-foreground">
              Defaults to the day after the current term ends, so there is no gap the brand was
              running an ad it had no licence for.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${formId}-paymentStatus`}>Payment status</Label>
            <Select
              value={form.paymentStatus}
              onValueChange={(value) =>
                setForm((f) => ({ ...f, paymentStatus: value as CampaignPaymentStatus }))
              }
            >
              <SelectTrigger id={`${formId}-paymentStatus`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {paymentStatusLabel(option)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor={`${formId}-paymentDue`}>Payment due</Label>
              <Input
                id={`${formId}-paymentDue`}
                type="date"
                value={form.paymentDue}
                onChange={(event) => setForm((f) => ({ ...f, paymentDue: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${formId}-paidDate`}>Paid on</Label>
              <Input
                id={`${formId}-paidDate`}
                type="date"
                value={form.paidDate}
                onChange={(event) => setForm((f) => ({ ...f, paidDate: event.target.value }))}
              />
            </div>
          </div>

          {/* Said up front rather than discovered afterwards: this form writes
              to two stores, and an invoice appearing unannounced in /invoices
              reads as a duplicate rather than as the thing that was asked for. */}
          <p className="text-[11px] text-muted-foreground">
            An invoice is raised for this automatically, as a draft, with the amount and term
            filled in. Nothing is charged, and no invoice is raised, when the amount is 0.
          </p>

          <div className="space-y-2">
            <Label htmlFor={`${formId}-paymentMethod`}>Payment method</Label>
            <Input
              id={`${formId}-paymentMethod`}
              placeholder="UPI, Bank transfer, ..."
              value={form.paymentMethod}
              onChange={(event) => setForm((f) => ({ ...f, paymentMethod: event.target.value }))}
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </form>

        <SheetFooter className="flex-row">
          <SheetClose asChild>
            <Button type="button" variant="outline" className="flex-1">
              Cancel
            </Button>
          </SheetClose>
          <Button type="submit" form={formId} className="flex-1" disabled={isPending || months < 1}>
            {isPending ? "Saving…" : "Record renewal"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
