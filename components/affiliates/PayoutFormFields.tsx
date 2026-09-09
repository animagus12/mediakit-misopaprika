"use client";

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
import {
  PAYOUT_PAYMENT_STATUSES,
  type AffiliatePayout,
  type PayoutPaymentStatus,
} from "@/repositories/affiliatePayouts";

export interface PayoutFormState {
  partnerId: string;
  periodStart: string;
  periodEnd: string;
  grossSales: string;
  salesCount: string;
  commissionAmount: string;
  paymentStatus: PayoutPaymentStatus;
  paidDate: string;
  paymentMethod: string;
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
    paymentStatus: "pending",
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
    paymentStatus: payout.paymentStatus,
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
            value={form.periodEnd}
            onChange={(event) => setForm((f) => ({ ...f, periodEnd: event.target.value }))}
          />
        </div>
      </div>

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

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-paymentStatus`}>Payment</Label>
          <Select
            value={form.paymentStatus}
            onValueChange={(value) =>
              setForm((f) => ({
                ...f,
                paymentStatus: value as PayoutPaymentStatus,
                // Reverting to pending drops the paid date with it, so the
                // stored record can never claim a date it did not arrive on.
                paidDate: value === "received" ? f.paidDate : "",
              }))
            }
          >
            <SelectTrigger id={`${idPrefix}-paymentStatus`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAYOUT_PAYMENT_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {status === "received" ? "Received" : "Pending"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-paidDate`}>Paid on</Label>
          <Input
            id={`${idPrefix}-paidDate`}
            type="date"
            disabled={form.paymentStatus !== "received"}
            value={form.paidDate}
            onChange={(event) => setForm((f) => ({ ...f, paidDate: event.target.value }))}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-method`}>Payment method</Label>
        <Input
          id={`${idPrefix}-method`}
          placeholder="Bank transfer"
          value={form.paymentMethod}
          onChange={(event) => setForm((f) => ({ ...f, paymentMethod: event.target.value }))}
        />
      </div>
    </>
  );
}
