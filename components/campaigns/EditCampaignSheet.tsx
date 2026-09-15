"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import {
  CampaignFormFields,
  campaignAmounts,
  type CampaignFormState,
  type CampaignLicenceContext,
} from "./CampaignFormFields";
import { UsageRightsPanel } from "./UsageRightsPanel";
import {
  REEL_OPTIONS,
  STORY_OPTIONS,
  CAMPAIGN_TYPES,
  isCampaignCalledOff,
  toIsoDate,
  type CampaignBrandOption,
} from "@/lib/campaigns";
import type { EditorVideoOption } from "@/lib/contentPlan";
import { renewalTotal } from "@/lib/usageRights";
import type { Campaign } from "@/repositories/campaigns";
import { notifyCreatedBrand } from "@/components/dashboard/createdBrandToast";

function latestRenewal(campaign: Campaign) {
  const { renewals } = campaign.usage;
  return renewals.length > 0 ? renewals[renewals.length - 1] : null;
}

function licenceContext(campaign: Campaign): CampaignLicenceContext {
  const renewal = latestRenewal(campaign);
  return {
    status: campaign.usage.status,
    pausedDays: campaign.usage.pausedDays,
    renewalStart: renewal ? toIsoDate(renewal.startDate) : null,
    renewalMoney: renewalTotal(campaign.usage),
  };
}

function formFromCampaign(campaign: Campaign): CampaignFormState {
  const renewal = latestRenewal(campaign);
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
    invoiceRef: campaign.invoiceRef,
    paymentDue: toIsoDate(campaign.paymentDue),
    paidDate: toIsoDate(campaign.paidDate),
    paymentMethod: campaign.paymentMethod,
    editorTransactionId: campaign.editorTransactionId,
    usageDays: campaign.usage.days > 0 ? String(campaign.usage.days) : "",
    usageIndefinite: campaign.usage.indefinite,
    usageRenewalDays: renewal ? String(renewal.days) : "",
    usageEndedOn: toIsoDate(campaign.usage.endedOn),
    usageFee: campaign.usage.fee > 0 ? String(campaign.usage.fee) : "",
  };
}

export function EditCampaignSheet({
  campaign,
  trigger,
  brandOptions = [],
  videoOptions = [],
}: {
  campaign: Campaign;
  trigger: ReactNode;
  brandOptions?: CampaignBrandOption[];
  videoOptions?: EditorVideoOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CampaignFormState>(() => formFromCampaign(campaign));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const formId = `edit-campaign-${campaign.id}`;
  // A deal linked to its invoice opens it. One that isn't gets the editor
  // prefilled from the deal, unless there is nothing to bill: a called-off deal
  // is owed nothing, and a deal with no value has no line to put a price on.
  // A deal whose invoice is only matched by its typed number still lands on
  // that invoice, since /invoices/new redirects to it rather than raise another.
  const invoiceHref = campaign.invoiceId
    ? `/invoices/${campaign.invoiceId}`
    : !isCampaignCalledOff(campaign.status) && campaign.total > 0
      ? `/invoices/new?campaignId=${encodeURIComponent(campaign.id)}`
      : null;

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
        ...campaignAmounts(form),
        paymentStatus: form.paymentStatus,
        date: form.date,
        uploadDate: form.uploadDate,
        invoiceRef: form.invoiceRef.trim(),
        paymentDue: form.paymentDue,
        paidDate: form.paidDate,
        paymentMethod: form.paymentMethod.trim(),
        editorTransactionId: form.editorTransactionId,
        usageDays: Number(form.usageDays) || 0,
        usageIndefinite: form.usageIndefinite,
        // Sent only where they mean something, so an unrenewed or live licence
        // never has a renewal length or end date written onto it.
        ...(campaign.usage.renewals.length > 0 && Number(form.usageRenewalDays) > 0
          ? { usageRenewalDays: Number(form.usageRenewalDays) }
          : {}),
        ...(campaign.usage.status === "ended" && form.usageEndedOn
          ? { usageEndedOn: form.usageEndedOn }
          : {}),
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

        {/* The licence panel sits beside the form rather than in it: its
            controls write on click and are not part of what Save submits, so
            putting them inside would invite the two to be confused. Both share
            one scroll container so the sheet still scrolls as a single body. */}
        <div className="flex-1 space-y-4 overflow-y-auto px-6">
          <form id={formId} onSubmit={handleSubmit} className="space-y-4">
            <CampaignFormFields
              idPrefix={formId}
              licence={licenceContext(campaign)}
              form={form}
              setForm={setForm}
              brandOptions={brandOptions}
              videoOptions={videoOptions}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </form>

          {invoiceHref && (
            <>
              <Separator />
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 space-y-0.5">
                  <p className="text-xs font-medium">Invoice</p>
                  <p className="text-[11px] text-muted-foreground">
                    {campaign.invoiceId
                      ? "Already raised for this deal."
                      : "Fills in the brand, deliverables, amounts and due date from this deal as last saved."}
                  </p>
                </div>
                <Button asChild size="sm" variant="outline" className="shrink-0">
                  <Link href={invoiceHref}>
                    <FileText />
                    {campaign.invoiceId ? "View invoice" : "Create invoice"}
                  </Link>
                </Button>
              </div>
            </>
          )}

          <Separator />

          <div className="space-y-2 pb-2">
            <p className="text-xs font-medium">Ad usage rights</p>
            <UsageRightsPanel campaign={campaign} />
          </div>
        </div>

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
