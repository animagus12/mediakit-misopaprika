"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
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
import { createAffiliatePayout } from "@/app/affiliates/actions";
import { PayoutFormFields, payoutInitialForm } from "./PayoutFormFields";
import type { AffiliatePartner } from "@/repositories/affiliatePartners";

export function NewPayoutButton({ partners }: { partners: AffiliatePartner[] }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => payoutInitialForm(partners));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createAffiliatePayout({
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
      setForm(payoutInitialForm(partners));
      setOpen(false);
    });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setError(null);
      }}
    >
      <SheetTrigger asChild>
        <Button size="sm" disabled={partners.length === 0}>
          <Plus className="size-3.5" />
          Record payout
        </Button>
      </SheetTrigger>
      <SheetContent className="flex flex-col gap-0">
        <SheetHeader>
          <SheetTitle>Record a payout</SheetTitle>
        </SheetHeader>

        <form
          id="new-affiliate-payout-form"
          onSubmit={handleSubmit}
          className="flex-1 space-y-4 overflow-y-auto px-6"
        >
          <PayoutFormFields
            idPrefix="new-payout"
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
            form="new-affiliate-payout-form"
            className="flex-1"
            disabled={isPending || !form.partnerId}
          >
            {isPending ? "Saving…" : "Save payout"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
