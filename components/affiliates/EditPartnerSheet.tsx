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
import { updateAffiliatePartner } from "@/app/affiliates/actions";
import {
  NONE,
  PartnerFormFields,
  partnerFormFrom,
  type BrandOption,
  type LinkItemOption,
} from "./PartnerFormFields";
import type { AffiliatePartner } from "@/repositories/affiliatePartners";

interface EditPartnerSheetProps {
  partner: AffiliatePartner;
  brands: BrandOption[];
  linkItems: LinkItemOption[];
  children: React.ReactNode;
}

export function EditPartnerSheet({ partner, brands, linkItems, children }: EditPartnerSheetProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => partnerFormFrom(partner));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateAffiliatePartner({
        id: partner.id,
        name: form.name.trim(),
        code: form.code.trim(),
        brandId: form.brandId === NONE ? null : form.brandId,
        trackingUrl: form.trackingUrl.trim(),
        commissionModel: form.commissionModel,
        commissionRate: Number(form.commissionRate) || 0,
        status: form.status,
        startDate: form.startDate,
        dashboardUrl: form.dashboardUrl.trim(),
        payoutSchedule: form.payoutSchedule,
        linkItemId: form.linkItemId === NONE ? null : form.linkItemId,
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
        // Reseed from the record on open: see EditPayoutSheet for why.
        if (next) {
          setForm(partnerFormFrom(partner));
          setError(null);
        }
      }}
    >
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent className="flex flex-col gap-0">
        <SheetHeader>
          <SheetTitle>Edit partner</SheetTitle>
        </SheetHeader>

        <form
          id={`edit-partner-form-${partner.id}`}
          onSubmit={handleSubmit}
          className="flex-1 space-y-4 overflow-y-auto px-6"
        >
          <PartnerFormFields
            idPrefix={`edit-partner-${partner.id}`}
            form={form}
            setForm={setForm}
            brands={brands}
            linkItems={linkItems}
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
            form={`edit-partner-form-${partner.id}`}
            className="flex-1"
            disabled={isPending || !form.name.trim() || !form.code.trim()}
          >
            {isPending ? "Saving…" : "Save changes"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
