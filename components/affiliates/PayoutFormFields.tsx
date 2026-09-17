"use client";

import { FieldGroup } from "@/components/common/FieldGroup";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMoney } from "@/lib/invoice";
import { expectedCommission } from "@/lib/affiliates";
import { toIsoDate } from "@/lib/editorTransactions";
import type { AffiliatePartner } from "@/repositories/affiliatePartners";
import type { AffiliatePayout, PayoutPaymentStatus } from "@/repositories/affiliatePayouts";

export interface PayoutFormState {
  partnerId: string;
  periodStart: string;
  periodEnd: string;
  grossSales: string;
  salesCount: string;
  commissionAmount: string;
  /** yyyy-mm-dd the money arrived, "" while it hasn't: see payoutPaymentFrom. */
  paidDate: string;
  paymentMethod: string;
}

/**
 * The payment a form state means: status and date together.
 *
 * A payout has two states and one of them is a date, so the date is the field
 * and the status follows it. Asking for both let a record say "received" with
 * no day it arrived on, which is the half of a payment record that the
 * commission-owed figures actually read.
 */
export function payoutPaymentFrom(form: PayoutFormState): {
  paymentStatus: PayoutPaymentStatus;
  paidDate: string;
} {
  const paidDate = form.paidDate.trim();
  return { paymentStatus: paidDate ? "received" : "pending", paidDate };
}

// Defaults to the month just gone, which is the period actually being entered:
// a payout is filed after its period closes, never during it.
function lastMonthRange(now: Date = new Date()): { start: string; end: string } {
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0);
  const iso = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
      date.getDate()
    ).padStart(2, "0")}`;
  return { start: iso(start), end: iso(end) };
}

export function payoutInitialForm(partners: AffiliatePartner[] = []): PayoutFormState {
  const { start, end } = lastMonthRange();
  return {
    partnerId: partners.find((partner) => partner.status === "active")?.id ?? partners[0]?.id ?? "",
    periodStart: start,
    periodEnd: end,
    grossSales: "",
    salesCount: "",
    commissionAmount: "",
    paidDate: "",
    paymentMethod: "",
  };
}

export function payoutFormFrom(payout: AffiliatePayout): PayoutFormState {
  return {
    partnerId: payout.partnerId,
    periodStart: toIsoDate(payout.periodStart),
    periodEnd: toIsoDate(payout.periodEnd),
    grossSales: payout.grossSales ? String(payout.grossSales) : "",
    salesCount: payout.salesCount ? String(payout.salesCount) : "",
    commissionAmount: payout.commissionAmount ? String(payout.commissionAmount) : "",
    paidDate: toIsoDate(payout.paidDate),
    paymentMethod: payout.paymentMethod,
  };
}

interface PayoutFormFieldsProps {
  idPrefix: string;
  form: PayoutFormState;
  setForm: React.Dispatch<React.SetStateAction<PayoutFormState>>;
  partners: AffiliatePartner[];
}

export function PayoutFormFields({ idPrefix, form, setForm, partners }: PayoutFormFieldsProps) {
  const partner = partners.find((entry) => entry.id === form.partnerId) ?? null;
  const expected = partner
    ? expectedCommission(partner, {
        grossSales: Number(form.grossSales) || 0,
        salesCount: Number(form.salesCount) || 0,
      })
    : null;

  return (
    <>
      <FieldGroup title="Period">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-partner`}>Partner</Label>
          {partners.length === 0 ? (
            <p className="text-xs text-muted-foreground">No partners yet. Add one first.</p>
          ) : (
            <Select
              value={form.partnerId}
              onValueChange={(value) => setForm((f) => ({ ...f, partnerId: value }))}
            >
              <SelectTrigger id={`${idPrefix}-partner`} className="w-full">
                <SelectValue placeholder="Select partner" />
              </SelectTrigger>
              <SelectContent>
                {partners.map((entry) => (
                  <SelectItem key={entry.id} value={entry.id}>
                    {entry.name}
                    <span className="text-muted-foreground"> · {entry.code}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-periodStart`}>Period start</Label>
            <Input
              id={`${idPrefix}-periodStart`}
              type="date"
              required
              value={form.periodStart}
              onChange={(event) => setForm((f) => ({ ...f, periodStart: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-periodEnd`}>Period end</Label>
            <Input
              id={`${idPrefix}-periodEnd`}
              type="date"
              required
              min={form.periodStart}
              value={form.periodEnd}
              onChange={(event) => setForm((f) => ({ ...f, periodEnd: event.target.value }))}
            />
          </div>
        </div>
      </FieldGroup>

      <FieldGroup title="Sales">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-grossSales`}>Gross sales (₹)</Label>
            <Input
              id={`${idPrefix}-grossSales`}
              type="number"
              min={0}
              placeholder="0"
              value={form.grossSales}
              onChange={(event) => setForm((f) => ({ ...f, grossSales: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-salesCount`}>Orders</Label>
            <Input
              id={`${idPrefix}-salesCount`}
              type="number"
              min={0}
              placeholder="0"
              value={form.salesCount}
              onChange={(event) => setForm((f) => ({ ...f, salesCount: event.target.value }))}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-commission`}>Commission (₹)</Label>
          <Input
            id={`${idPrefix}-commission`}
            type="number"
            min={0}
            step="0.01"
            placeholder="0"
            value={form.commissionAmount}
            onChange={(event) => setForm((f) => ({ ...f, commissionAmount: event.target.value }))}
          />
          {/* What the program's own terms imply, offered as a check rather than
              filled in: brands net off returns before they pay, so the portal's
              figure is the true one and a mismatch is a question to ask them. */}
          {expected !== null && (
            <button
              type="button"
              className="text-[0.7rem] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              onClick={() =>
                setForm((f) => ({ ...f, commissionAmount: String(Math.round(expected * 100) / 100) }))
              }
            >
              Terms imply {formatMoney(expected)} · use this
            </button>
          )}
        </div>
      </FieldGroup>

      <FieldGroup title="Payment">
        {/* No status field: a payout is received on the day it arrives and
            pending until then, so the date is the whole answer (see
            payoutPaymentFrom). One field that can't disagree with itself,
            where two could. */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-paidDate`}>Paid on</Label>
            <Input
              id={`${idPrefix}-paidDate`}
              type="date"
              value={form.paidDate}
              onChange={(event) => setForm((f) => ({ ...f, paidDate: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-method`}>Method</Label>
            <Input
              id={`${idPrefix}-method`}
              placeholder="Bank transfer"
              value={form.paymentMethod}
              onChange={(event) => setForm((f) => ({ ...f, paymentMethod: event.target.value }))}
            />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {form.paidDate.trim()
            ? "Received. Clear the date to put it back to pending."
            : "Pending until you fill in the day it arrived."}
        </p>
      </FieldGroup>
    </>
  );
}
