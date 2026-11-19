"use client";

import { MoneyInput } from "@/components/common/MoneyInput";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { todayKey } from "@/lib/day";
import { formatMoney } from "@/lib/invoice";
import { PAYMENT_METHOD_OPTIONS, type PaymentMethod } from "@/lib/payers";
import {
  negativeAmountProblem,
  parseFormAmount,
  withBankFee,
  withGross,
  withNet,
  withTds,
  type PaymentFormState,
} from "@/lib/paymentForm";
import { tdsRateOf } from "@/lib/tds";
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
 * expected rate until net received or TDS is typed, net received works out
 * TDS (or the charges, on a payment without TDS), so the four amounts always
 * add up.
 */
export function PaymentFields({ idPrefix, form, onChange, expectedTdsRate, grossLocked = false }: PaymentFieldsProps) {
  const amountProblem = negativeAmountProblem(form);
  const withheldRate = form.tdsMode === "net" ? tdsRateOf(parseFormAmount(form.gross), parseFormAmount(form.tds)) : null;
  const id = (field: string) => `${idPrefix}-${field}`;

  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor={id("date")}>Date received</FieldLabel>
        <Input
          id={id("date")}
          type="date"
          max={todayKey()}
          required
          value={form.date}
          onChange={(event) => onChange({ ...form, date: event.target.value })}
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 min-[400px]:grid-cols-2">
        <Field className="min-w-0">
          <FieldLabel htmlFor={id("gross")}>Amount settled</FieldLabel>
          <MoneyInput
            id={id("gross")}
            readOnly={grossLocked}
            value={form.gross}
            onChange={(event) => onChange(withGross(form, event.target.value, expectedTdsRate))}
          />
          <FieldDescription>What this clears from the amount owed, before TDS and charges.</FieldDescription>
        </Field>
        <Field className="min-w-0">
          <FieldLabel htmlFor={id("tds")}>TDS withheld</FieldLabel>
          <MoneyInput
            id={id("tds")}
            value={form.tds}
            onChange={(event) => onChange(withTds(form, event.target.value))}
          />
          {form.tdsMode === "rate" && expectedTdsRate !== null && expectedTdsRate > 0 && (
            <FieldDescription>Estimated at {expectedTdsRate}%.</FieldDescription>
          )}
          {withheldRate !== null && withheldRate >= 0 && (
            <FieldDescription>{withheldRate}% of the amount, from net received.</FieldDescription>
          )}
        </Field>
        <Field className="min-w-0">
          <FieldLabel htmlFor={id("fee")}>Bank charges</FieldLabel>
          <MoneyInput
            id={id("fee")}
            value={form.bankFee}
            onChange={(event) => onChange(withBankFee(form, event.target.value))}
          />
        </Field>
        <Field className="min-w-0" data-invalid={amountProblem !== null || undefined}>
          <FieldLabel htmlFor={id("net")}>Net received</FieldLabel>
          <MoneyInput
            id={id("net")}
            aria-invalid={amountProblem !== null}
            value={form.net}
            onChange={(event) => onChange(withNet(form, event.target.value, expectedTdsRate))}
          />
        </Field>
      </div>
      <p className={cn("-mt-2 text-xs", amountProblem ? "text-destructive" : "text-muted-foreground")}>
        {amountProblem ?? `${formatMoney(parseFormAmount(form.net) || 0)} landed in the account.`}
      </p>

      {/* No "received into": money in always lands in the business account. */}
      <Field>
        <FieldLabel htmlFor={id("method")}>Method</FieldLabel>
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
      </Field>

      <Field>
        <FieldLabel htmlFor={id("reference")}>
          Reference
          <span className="font-normal text-muted-foreground">Optional</span>
        </FieldLabel>
        <Input
          id={id("reference")}
          maxLength={PAYMENT_REFERENCE_MAX}
          placeholder="UTR or cheque number"
          value={form.reference}
          onChange={(event) => onChange({ ...form, reference: event.target.value })}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={id("note")}>
          Note
          <span className="font-normal text-muted-foreground">Optional</span>
        </FieldLabel>
        <Textarea
          id={id("note")}
          rows={2}
          maxLength={PAYMENT_NOTE_MAX}
          value={form.note}
          onChange={(event) => onChange({ ...form, note: event.target.value })}
        />
      </Field>
    </FieldGroup>
  );
}
