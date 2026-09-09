"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { updateAffiliatePayout } from "@/app/affiliates/actions";
import { PayoutFormFields, payoutFormFrom } from "./PayoutFormFields";
import type { AffiliatePartner } from "@/repositories/affiliatePartners";
import type { AffiliatePayout } from "@/repositories/affiliatePayouts";

interface EditPayoutSheetProps {
  payout: AffiliatePayout;
  partners: AffiliatePartner[];
  children: React.ReactNode;
}

export function EditPayoutSheet({ payout, partners, children }: EditPayoutSheetProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => payoutFormFrom(payout));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateAffiliatePayout({
        id: payout.id,
        partnerId: form.partnerId,
        periodStart: form.periodStart,
        periodEnd: form.periodEnd,
        grossSales: Number(form.grossSales) || 0,
        salesCount: Number(form.salesCount) || 0,
        commissionAmount: Number(form.commissionAmount) || 0,
        paymentStatus: form.paymentStatus,
        paidDate: form.paidDate,
        paymentMethod: form.paymentMethod.trim(),
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setOpen(false);
    });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Reset from the record on open, not on close: the row behind this
        // sheet re-renders from the server after a save, and seeding from
        // stale props would show the old figures the next time it opens.
        if (next) {
          setForm(payoutFormFrom(payout));
          setError(null);
        }
      }}
    >
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent className="flex flex-col gap-0">
        <SheetHeader>
          <SheetTitle>Edit payout</SheetTitle>
        </SheetHeader>

        <form
          id={`edit-payout-form-${payout.id}`}
          onSubmit={handleSubmit}
          className="flex-1 space-y-4 overflow-y-auto px-6"
        >
          <PayoutFormFields
            idPrefix={`edit-payout-${payout.id}`}
            form={form}
            setForm={setForm}
            partners={partners}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </form>

        <SheetFooter className="flex-row">
          <SheetClose asChild>
            <Button type="button" variant="outline" className="flex-1">
              Cancel
            </Button>
          </SheetClose>
          <Button
            type="submit"
            form={`edit-payout-form-${payout.id}`}
            className="flex-1"
            disabled={isPending || !form.partnerId}
          >
            {isPending ? "Saving…" : "Save changes"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
