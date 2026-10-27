"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { todayKey } from "@/lib/day";
import { formatMoney } from "@/lib/invoice";
import { PAYMENT_METHOD_OPTIONS, type PaymentMethod } from "@/lib/payers";
import {
  hasNegativeCharges,
  parseFormAmount,
  withBankFee,
  withGross,
  withNet,
  withTds,
  type PaymentFormState,
} from "@/lib/paymentForm";
import { cn } from "@/lib/utils";
import { PAYMENT_NOTE_MAX, PAYMENT_REFERENCE_MAX } from "@/repositories/payments";

// Radix Select can't take "" as an item value.
const NO_METHOD = "__none__";

interface PaymentFieldsProps {
  /** Keeps <label htmlFor> ids unique when several forms are mounted at once. */
  idPrefix: string;
  form: PaymentFormState;
  onChange: (next: PaymentFormState) => void;
  expectedTdsRate: number | null;
  /** The amount is fixed by what it settles (a deal or renewal entered as already received). */
  grossLocked?: boolean;
}

/**
 * One payment's fields: when it arrived, how much it settled, what the brand
 * withheld and the bank took, and what landed in the business account.
 *
 * Controlled, with the arithmetic in lib/paymentForm.ts: TDS follows the
 * expected rate until it is typed over, and net and charges recompute each
 * other, so the four amounts always add up.
 */
export function PaymentFields({ idPrefix, form, onChange, expectedTdsRate, grossLocked = false }: PaymentFieldsProps) {
  const negativeCharges = hasNegativeCharges(form);
  const id = (field: string) => `${idPrefix}-${field}`;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={id("date")}>Date received</Label>
        <Input
          id={id("date")}
          type="date"
          max={todayKey()}
          required
          value={form.date}
          onChange={(event) => onChange({ ...form, date: event.target.value })}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
        <div className="min-w-0 space-y-2">
          <Label htmlFor={id("gross")}>Amount settled (₹)</Label>
          <Input
            id={id("gross")}
            inputMode="decimal"
            className="tabular-nums"
            readOnly={grossLocked}
            value={form.gross}
            onChange={(event) => onChange(withGross(form, event.target.value, expectedTdsRate))}
          />
          <p className="text-[11px] text-muted-foreground">What this clears from the amount owed, before TDS and charges.</p>
        </div>
        <div className="min-w-0 space-y-2">
          <Label htmlFor={id("tds")}>TDS withheld (₹)</Label>
          <Input
            id={id("tds")}
            inputMode="decimal"
            className="tabular-nums"
            value={form.tds}
            onChange={(event) => onChange(withTds(form, event.target.value))}
          />
          {!form.tdsTouched && expectedTdsRate !== null && expectedTdsRate > 0 && (
            <p className="text-[11px] text-muted-foreground">Estimated at {expectedTdsRate}%.</p>
          )}
        </div>
        <div className="min-w-0 space-y-2">
          <Label htmlFor={id("fee")}>Bank charges (₹)</Label>
          <Input
            id={id("fee")}
            inputMode="decimal"
            className="tabular-nums"
            value={form.bankFee}
            onChange={(event) => onChange(withBankFee(form, event.target.value))}
          />
        </div>
        <div className="min-w-0 space-y-2">
          <Label htmlFor={id("net")}>Net received (₹)</Label>
          <Input
            id={id("net")}
            inputMode="decimal"
            className="tabular-nums"
            aria-invalid={negativeCharges}
            value={form.net}
            onChange={(event) => onChange(withNet(form, event.target.value))}
          />
        </div>
      </div>
      <p className={cn("text-[11px]", negativeCharges ? "text-destructive" : "text-muted-foreground")}>
        {negativeCharges
          ? "Net received can't be more than the amount less TDS."
          : `${formatMoney(parseFormAmount(form.net) || 0)} landed in the account.`}
      </p>

      {/* No "received into": money in always lands in the business account. */}
      <div className="space-y-2">
        <Label htmlFor={id("method")}>Method</Label>
        <Select
          value={form.method || NO_METHOD}
          onValueChange={(value) => onChange({ ...form, method: value === NO_METHOD ? "" : (value as PaymentMethod) })}
        >
          <SelectTrigger id={id("method")} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_METHOD}>Not recorded</SelectItem>
            {PAYMENT_METHOD_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor={id("reference")}>Reference</Label>
        <Input
          id={id("reference")}
          maxLength={PAYMENT_REFERENCE_MAX}
          placeholder="UTR or cheque number"
          value={form.reference}
          onChange={(event) => onChange({ ...form, reference: event.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={id("note")}>Note</Label>
        <Textarea
          id={id("note")}
          rows={2}
          maxLength={PAYMENT_NOTE_MAX}
          value={form.note}
          onChange={(event) => onChange({ ...form, note: event.target.value })}
        />
      </div>
    </div>
  );
}
