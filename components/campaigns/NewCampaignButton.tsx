"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
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
import { createCampaign } from "@/app/(dashboard)/actions";
import type { CampaignBrandOption } from "@/lib/campaigns";
import { CampaignFormFields, campaignInitialForm } from "./CampaignFormFields";
import { notifyCreatedBrand } from "@/components/dashboard/createdBrandToast";

export function NewCampaignButton({ brandOptions = [] }: { brandOptions?: CampaignBrandOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(campaignInitialForm);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createCampaign({
        brand: form.brand.trim(),
        brandId: form.brandId,
        campaign: form.campaign.trim(),
        type: form.type,
        reels: form.reels,
        story: form.story,
        status: form.status,
        amount: Number(form.amount) || 0,
        barterValue: Number(form.barterValue) || 0,
        paymentStatus: form.paymentStatus,
        date: form.date,
        uploadDate: form.uploadDate,
        invoiceId: form.invoiceId.trim(),
        paymentDue: form.paymentDue,
        paymentMethod: form.paymentMethod.trim(),
        notes: form.notes.trim(),
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      notifyCreatedBrand(result.createdBrand, router);
      setForm(campaignInitialForm());
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
        <Button size="sm">
          <Plus className="size-3.5" />
          New campaign
        </Button>
      </SheetTrigger>
      <SheetContent className="flex flex-col gap-0">
        <SheetHeader>
          <SheetTitle>New campaign</SheetTitle>
          <SheetDescription>
            Records a new campaign. Payment status defaults to
            unmarked — fill in payment details once the deal is paid out.
          </SheetDescription>
        </SheetHeader>

        <form
          id="new-campaign-form"
          onSubmit={handleSubmit}
          className="flex-1 space-y-4 overflow-y-auto px-6"
        >
          <CampaignFormFields idPrefix="new-campaign" form={form} setForm={setForm} brandOptions={brandOptions} />
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
            form="new-campaign-form"
            className="flex-1"
            disabled={isPending || !form.brand.trim()}
          >
            {isPending ? "Adding…" : "Add campaign"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
