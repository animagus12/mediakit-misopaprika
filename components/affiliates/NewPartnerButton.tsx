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
import { createAffiliatePartner } from "@/app/affiliates/actions";
import {
  NONE,
  PartnerFormFields,
  partnerInitialForm,
  type BrandOption,
  type LinkItemOption,
} from "./PartnerFormFields";

interface NewPartnerButtonProps {
  brands: BrandOption[];
  linkItems: LinkItemOption[];
}

export function NewPartnerButton({ brands, linkItems }: NewPartnerButtonProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(partnerInitialForm);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createAffiliatePartner({
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
      setForm(partnerInitialForm());
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
        <Button size="sm" variant="outline">
          <Plus className="size-3.5" />
          New partner
        </Button>
      </SheetTrigger>
      <SheetContent className="flex flex-col gap-0">
        <SheetHeader>
          <SheetTitle>New affiliate partner</SheetTitle>
        </SheetHeader>

        <form
          id="new-affiliate-partner-form"
          onSubmit={handleSubmit}
          className="flex-1 space-y-4 overflow-y-auto px-6"
        >
          <PartnerFormFields
            idPrefix="new-partner"
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
            form="new-affiliate-partner-form"
            className="flex-1"
            disabled={isPending || !form.name.trim() || !form.code.trim()}
          >
            {isPending ? "Adding…" : "Add partner"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
