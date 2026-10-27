"use client";

import { useId, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { recordPayment, updatePayment } from "@/app/payments/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { todayKey } from "@/lib/day";
import { formatMoney } from "@/lib/invoice";
import { roundMoney } from "@/lib/money";
import type { Payer } from "@/lib/payers";
import { hasNegativeCharges, paymentFormFrom, paymentInputFrom, type PaymentFormState } from "@/lib/paymentForm";
import { suggestPayment, validatePayment } from "@/lib/payments";
import type { LedgerEntry, Settlement } from "@/repositories/payments";
import { PaymentFields } from "./PaymentFields";

interface RecordPaymentSheetProps {
  settlement: Settlement;
  /** "IG Page", "IG Page · renewal R0002": shown under the title. */
  targetLabel: string;
  expectedTdsRate: number | null;
  /** The payment being edited; absent records a new one. */
  entry?: LedgerEntry;
  /** Whose account a new payment starts on: the one this target's last payment used. */
  defaultReceivedInto: Payer;
  /** Opens the sheet; leave out and pass `open` to control it from outside (a menu item). */
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

function initialForm(props: RecordPaymentSheetProps): PaymentFormState {
  const { entry, settlement, expectedTdsRate, defaultReceivedInto } = props;
  if (entry) {
    return paymentFormFrom(
      {
        // An entry from an earlier record may have no date; today is the
        // likeliest correction and the form refuses none.
        date: entry.date || todayKey(),
        gross: entry.gross,
        tds: entry.tds,
        bankFee: entry.bankFee,
        receivedInto: entry.receivedInto,
        method: entry.method,
        reference: entry.reference,
        note: entry.note,
      },
      true
    );
  }
  const suggestion = suggestPayment(settlement, expectedTdsRate, { receivedInto: defaultReceivedInto, method: null }, todayKey());
  return paymentFormFrom(suggestion, false);
}

/**
 * Records a payment against a deal, renewal or invoice, or edits one.
 *
 * The id is made once per opening, so saving twice (a double tap, a retry
 * after a slow network) records one payment. Checked here with the same
 * validatePayment the server runs, so a mistake is shown beside the form
 * rather than after a round trip.
 */
export function RecordPaymentSheet(props: RecordPaymentSheetProps) {
  const { settlement, targetLabel, entry, expectedTdsRate, trigger } = props;
  const [ownOpen, setOwnOpen] = useState(false);
  const open = props.open ?? ownOpen;
  const setOpen = props.onOpenChange ?? setOwnOpen;
  // Seeded at mount too, for a sheet mounted already open (controlled).
  const [form, setForm] = useState<PaymentFormState>(() => initialForm(props));
  const [paymentId, setPaymentId] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const editing = entry !== undefined;
  const formId = `payment-${useId()}`;
  const settledElsewhere = roundMoney(settlement.settled - (entry?.gross ?? 0));
  const afterThis = roundMoney(settlement.owed - settledElsewhere - (Number(form.gross) || 0));

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const input = paymentInputFrom(form, editing ? entry.id : paymentId, settlement.target);
    const problem = hasNegativeCharges(form)
      ? "Net received can't be more than the amount less TDS"
      : validatePayment(input, {
          mode: editing ? "update" : "create",
          targetState: "ok",
          owed: settlement.owed,
          settledExcludingThis: settledElsewhere,
          previousGross: entry?.gross ?? 0,
          today: todayKey(),
          existingTarget: entry?.target ?? null,
        });
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = editing ? await updatePayment(input) : await recordPayment(input);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setOpen(false);
      const title = `${targetLabel}: payment ${editing ? "saved" : "recorded"}`;
      if (result.warning) toast.warning(title, { description: result.warning });
      else toast.success(title, { description: `${formatMoney(input.gross)} settled.` });
    });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Reseeded on open, so a sheet left mounted starts from what is owed now.
        if (next) {
          setForm(initialForm(props));
          setPaymentId(crypto.randomUUID());
          setError(null);
        }
      }}
    >
      {trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader className="min-w-0">
          <SheetTitle>{editing ? "Edit payment" : "Record payment"}</SheetTitle>
          <SheetDescription className="truncate">{targetLabel}</SheetDescription>
          <p className="text-xs text-muted-foreground tabular-nums">
            {formatMoney(settlement.owed)} owed · {formatMoney(settledElsewhere)} received ·{" "}
            {afterThis <= 0 ? "Paid in full with this" : `${formatMoney(afterThis)} left after this`}
          </p>
          {entry && entry.origin === "legacy" && (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">From earlier record</Badge>
              {entry.source === "virtual" && (
                <span className="text-[11px] text-muted-foreground">Saving turns this into a recorded payment.</span>
              )}
            </div>
          )}
        </SheetHeader>

        <form id={formId} onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto px-6 pb-4">
          <PaymentFields idPrefix={formId} form={form} onChange={setForm} expectedTdsRate={expectedTdsRate} />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </form>

        <SheetFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <SheetClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </SheetClose>
          <Button type="submit" form={formId} disabled={isPending}>
            {isPending ? "Saving…" : editing ? "Save payment" : "Record payment"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
