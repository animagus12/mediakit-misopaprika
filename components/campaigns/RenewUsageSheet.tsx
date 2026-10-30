"use client";

import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { PaymentFields } from "@/components/payments/PaymentFields";
import { todayKey } from "@/lib/day";
import { buildInvoiceNumber } from "@/lib/invoice";
import { hasNegativeCharges, paymentFormFrom, paymentValuesFrom, withGross, type PaymentFormState } from "@/lib/paymentForm";
import { parseTdsInput } from "@/lib/tds";
import { defaultRenewalStart, formatUsageDays, type UsageTerm } from "@/lib/usageRights";
import { TdsFields } from "./TdsFields";

interface RenewFormState {
  days: string;
  amount: string;
  startDate: string;
  paymentDue: string;
  tdsRate: string;
  /** The brand has already paid for this renewal: record that payment with it. */
  received: boolean;
  payment: PaymentFormState;
}

function blankPayment(): PaymentFormState {
  return paymentFormFrom(
    { date: todayKey(), gross: 0, tds: 0, bankFee: 0, method: null, reference: "", note: "" },
    false
  );
}

// Ninety days, a quarter, is the term most licences are written for, so it is
// what the field opens on; the amount deliberately is not guessed from the deal, since
// a renewal is negotiated separately and a prefilled price is one nobody
// re-reads before saving. The TDS rate is: a brand withholds at the same rate
// on every payment it makes, so the deal's rate is the likely answer.
function initialForm(term: UsageTerm, defaultTdsRate: number | null): RenewFormState {
  return {
    days: "90",
    amount: "",
    startDate: defaultRenewalStart(term),
    paymentDue: "",
    tdsRate: defaultTdsRate === null ? "" : String(defaultTdsRate),
    received: false,
    payment: blankPayment(),
  };
}

interface RenewUsageSheetProps {
  campaignId: string;
  brand: string;
  term: UsageTerm;
  /** The deal's TDS rate, which a new renewal's rate opens on; null leaves it blank. */
  defaultTdsRate: number | null;
  trigger: ReactNode;
  /** Fired once the renewal is saved, so a list can drop the row it came from. */
  onRenewed?: () => void;
}

/**
 * Buys another term on a licence, and records what the brand paid for it when
 * it has already paid.
 *
 * A sheet rather than an inline control because a renewal is a transaction:
 * it has a price, a due date and possibly a payment, and squeezing that into a
 * row in an alert list would either lose fields or make the row unreadable.
 * The same reason the deal itself is edited in one.
 */
export function RenewUsageSheet({
  campaignId,
  brand,
  term,
  defaultTdsRate,
  trigger,
  onRenewed,
}: RenewUsageSheetProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<RenewFormState>(() => initialForm(term, defaultTdsRate));
  const [paymentId, setPaymentId] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const formId = `renew-usage-${campaignId}`;
  const days = Number(form.days) || 0;
  const amount = Number(form.amount) || 0;
  const expectedRate = parseTdsInput(form.tdsRate);

  // The payment settles the whole fee: its amount follows the fee as typed,
  // and its TDS the expected rate, until the TDS is typed over.
  function setAmount(value: string) {
    setForm((f) => ({ ...f, amount: value, payment: withGross(f.payment, String(Number(value) || 0), parseTdsInput(f.tdsRate)) }));
  }

  function setReceived(received: boolean) {
    setForm((f) => ({
      ...f,
      received,
      payment: received ? withGross(f.payment, String(Number(f.amount) || 0), parseTdsInput(f.tdsRate)) : f.payment,
    }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (form.received) {
      if (amount <= 0) {
        setError("A free renewal has nothing to record as received");
        return;
      }
      if (hasNegativeCharges(form.payment)) {
        setError("Net received can't be more than the amount less TDS");
        return;
      }
    }
    const received = paymentValuesFrom(form.payment, paymentId);
    startTransition(async () => {
      const result = await renewCampaignUsage(
        campaignId,
        {
          startDate: form.startDate,
          days,
          amount,
          paymentDue: form.paymentDue,
          tdsRate: expectedRate,
        },
        form.received ? received : undefined
      );
      if (!result.success) {
        setError(result.error);
        return;
      }
      setOpen(false);
      onRenewed?.();

      const termText = `${formatUsageDays(days)} more`;
      if (result.warning) {
        // The renewal landed either way; the warning is about what didn't
        // follow (its invoice or its payment), which is worth saying.
        toast.warning(`${brand}: usage renewed`, { description: `${termText}. ${result.warning}` });
        return;
      }
      toast.success(`${brand}: usage renewed`, {
        description: result.invoiceNo
          ? `${termText}. Invoice ${buildInvoiceNumber(result.invoiceNo)} raised as a draft.`
          : `${termText}. No invoice raised: nothing was charged.`,
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
          setForm(initialForm(term, defaultTdsRate));
          setPaymentId(crypto.randomUUID());
          setError(null);
        }
      }}
    >
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Renew ad usage</SheetTitle>
          <SheetDescription>
            Extends {brand}&apos;s licence by another term, and records the payment if they have already paid.
          </SheetDescription>
        </SheetHeader>

        <form id={formId} onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto px-6 pb-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0 space-y-2">
              <Label htmlFor={`${formId}-days`}>Days</Label>
              <Input
                id={`${formId}-days`}
                type="number"
                min={1}
                step={1}
                required
                value={form.days}
                onChange={(event) => setForm((f) => ({ ...f, days: event.target.value }))}
              />
            </div>
            <div className="min-w-0 space-y-2">
              <Label htmlFor={`${formId}-amount`}>Amount (₹)</Label>
              <Input
                id={`${formId}-amount`}
                type="number"
                min={0}
                placeholder="0"
                value={form.amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0 space-y-2">
              <Label htmlFor={`${formId}-startDate`}>Runs from</Label>
              <Input
                id={`${formId}-startDate`}
                type="date"
                required
                value={form.startDate}
                onChange={(event) => setForm((f) => ({ ...f, startDate: event.target.value }))}
              />
            </div>
            <div className="min-w-0 space-y-2">
              <Label htmlFor={`${formId}-paymentDue`}>Payment due</Label>
              <Input
                id={`${formId}-paymentDue`}
                type="date"
                value={form.paymentDue}
                onChange={(event) => setForm((f) => ({ ...f, paymentDue: event.target.value }))}
              />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            The term defaults to starting the day after the current one ends, so there is no gap the brand was
            running an ad it had no licence for.
          </p>

          {/* Said up front rather than discovered afterwards: this form writes
              to two stores, and an invoice appearing unannounced in /invoices
              reads as a duplicate rather than as the thing that was asked for. */}
          <p className="text-[11px] text-muted-foreground">
            An invoice is raised for this automatically, as a draft, with the amount and term filled in. Nothing
            is charged, and no invoice is raised, when the amount is 0.
          </p>

          <TdsFields
            idPrefix={formId}
            rate={form.tdsRate}
            onRateChange={(value) => setForm((f) => ({ ...f, tdsRate: value }))}
            gross={amount}
            description={
              defaultTdsRate === null
                ? "The rate the brand withholds from this renewal's fee."
                : "The rate starts at the deal's. Change it if this renewal differs."
            }
          />

          <div className="space-y-3 rounded-lg border border-border p-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id={`${formId}-received`}
                checked={form.received}
                onCheckedChange={(checked) => setReceived(checked === true)}
              />
              <Label htmlFor={`${formId}-received`}>Already received</Label>
            </div>
            {form.received && (
              <PaymentFields
                idPrefix={`${formId}-payment`}
                form={form.payment}
                onChange={(payment) => setForm((f) => ({ ...f, payment }))}
                expectedTdsRate={expectedRate}
                grossLocked
              />
            )}
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </form>

        <SheetFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <SheetClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </SheetClose>
          <Button type="submit" form={formId} disabled={isPending || days < 1}>
            {isPending ? "Saving…" : "Record renewal"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
