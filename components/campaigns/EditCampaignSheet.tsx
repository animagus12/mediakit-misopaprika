"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
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
import { updateCampaign } from "@/app/(dashboard)/actions";
import { CampaignFormFields, type CampaignFormState } from "./CampaignFormFields";
import {
  REEL_OPTIONS,
  STORY_OPTIONS,
  CAMPAIGN_TYPES,
  toIsoDate,
  type CampaignBrandOption,
} from "@/lib/campaigns";
import type { Campaign } from "@/repositories/campaigns";
import { notifyCreatedBrand } from "@/components/dashboard/createdBrandToast";

function formFromCampaign(campaign: Campaign): CampaignFormState {
  return {
    brand: campaign.brand,
    brandId: campaign.brandId,
    campaign: campaign.campaign,
    type: CAMPAIGN_TYPES.includes(campaign.type as (typeof CAMPAIGN_TYPES)[number])
      ? (campaign.type as CampaignFormState["type"])
      : "Barter",
    reels: campaign.reels || REEL_OPTIONS[0],
    story: campaign.story || STORY_OPTIONS[0],
    status: campaign.status,
    amount: campaign.amount > 0 ? String(campaign.amount) : "",
    barterValue: campaign.barterValue > 0 ? String(campaign.barterValue) : "",
    paymentStatus: campaign.paymentStatus,
    date: toIsoDate(campaign.date) || new Date().toISOString().slice(0, 10),
    uploadDate: toIsoDate(campaign.uploadDate),
    invoiceId: campaign.invoiceId,
    paymentDue: toIsoDate(campaign.paymentDue),
    paymentMethod: campaign.paymentMethod,
    notes: campaign.notes,
  };
}

export function EditCampaignSheet({
  campaign,
  trigger,
  brandOptions = [],
}: {
  campaign: Campaign;
  trigger: ReactNode;
  brandOptions?: CampaignBrandOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CampaignFormState>(() => formFromCampaign(campaign));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const formId = `edit-campaign-${campaign.id}`;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateCampaign({
        id: campaign.id,
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
      setOpen(false);
    });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setForm(formFromCampaign(campaign));
          setError(null);
        }
      }}
    >
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="flex flex-col gap-0">
        <SheetHeader>
          <SheetTitle>Edit campaign</SheetTitle>
          <SheetDescription>Updates this campaign&apos;s record.</SheetDescription>
        </SheetHeader>

        <form id={formId} onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto px-6">
          <CampaignFormFields idPrefix={formId} form={form} setForm={setForm} brandOptions={brandOptions} />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </form>

        <SheetFooter className="flex-row">
          <SheetClose asChild>
            <Button type="button" variant="outline" className="flex-1">
              Cancel
            </Button>
          </SheetClose>
          <Button type="submit" form={formId} className="flex-1" disabled={isPending || !form.brand.trim()}>
            {isPending ? "Saving…" : "Save changes"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
