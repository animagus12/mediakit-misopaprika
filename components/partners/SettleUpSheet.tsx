"use client";

import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { recordSettleUp } from "@/app/partners/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { todayKey } from "@/lib/day";
import { formatMoney } from "@/lib/invoice";
import { settleUpLabel, validateSettleUp } from "@/lib/partners";
import { parseFormAmount } from "@/lib/paymentForm";
import { PAYER_OPTIONS, type Payer } from "@/lib/payers";
import { PARTNER_TRANSFER_NOTE_MAX } from "@/repositories/partnerTransfers";

export interface SettleUpDefaults {
  from: Payer;
  to: Payer;
  /** 0 to leave the amount for the person to type. */
  amount: number;
}

interface SettleUpSheetProps {
  defaults: SettleUpDefaults;
  /** Mounted open, once per opening, so each settle-up gets a fresh id. */
  onClose: () => void;
}

/**
 * Records money moving to settle up: the business repaying a partner, or one
 * partner paying the other their half. Opened from a balance it starts on
 * that balance, so squaring up is one tap and a save.
 */
export function SettleUpSheet({ defaults, onClose }: SettleUpSheetProps) {
  const [from, setFrom] = useState<Payer>(defaults.from);
  const [to, setTo] = useState<Payer>(defaults.to);
  const [amount, setAmount] = useState(defaults.amount > 0 ? String(defaults.amount) : "");
  const [date, setDate] = useState(todayKey());
  const [note, setNote] = useState("");
  const [id] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formId = `settle-up-${useId()}`;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const input = { id, date, from, to, amount: parseFormAmount(amount), note: note.trim() };
    const problem = validateSettleUp(input, todayKey());
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await recordSettleUp(input);
      if (!result.success) {
        setError(result.error);
        return;
      }
      onClose();
      toast.success(`${settleUpLabel(input)} ${formatMoney(input.amount)}`, { description: "Recorded as a settle-up." });
    });
  }

  function payerSelect(field: "from" | "to", value: Payer, onChange: (payer: Payer) => void) {
    return (
      <Select value={value} onValueChange={(next) => onChange(next as Payer)}>
        <SelectTrigger id={`${formId}-${field}`} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PAYER_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Settle up</SheetTitle>
          <SheetDescription>
            Money moved to square up a cost one of you paid personally. It isn&apos;t income or a cost, so it changes
            only who owes whom.
          </SheetDescription>
        </SheetHeader>

        <form id={formId} onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto px-6 pb-4">
          <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <Label htmlFor={`${formId}-from`}>Paid by</Label>
              {payerSelect("from", from, setFrom)}
            </div>
            <div className="min-w-0 space-y-2">
              <Label htmlFor={`${formId}-to`}>Paid to</Label>
              {payerSelect("to", to, setTo)}
            </div>
            <div className="min-w-0 space-y-2">
              <Label htmlFor={`${formId}-amount`}>Amount (₹)</Label>
              <Input
                id={`${formId}-amount`}
                inputMode="decimal"
                className="tabular-nums"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </div>
            <div className="min-w-0 space-y-2">
              <Label htmlFor={`${formId}-date`}>Date</Label>
              <Input
                id={`${formId}-date`}
                type="date"
                max={todayKey()}
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${formId}-note`}>Note</Label>
            <Input
              id={`${formId}-note`}
              maxLength={PARTNER_TRANSFER_NOTE_MAX}
              placeholder="e.g. UPI for the props"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </form>

        <SheetFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <SheetClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </SheetClose>
          <Button type="submit" form={formId} disabled={isPending}>
            {isPending ? "Saving…" : "Record settle-up"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
