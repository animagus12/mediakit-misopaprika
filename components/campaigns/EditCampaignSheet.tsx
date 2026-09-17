"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Unlink } from "lucide-react";
import { toast } from "sonner";
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
import { unlinkCampaignInvoice, updateCampaign } from "@/app/(dashboard)/actions";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CampaignInvoiceOption } from "@/lib/invoice";
import {
  CampaignFormFields,
  campaignAmounts,
  type CampaignDueInvoice,
  type CampaignFormState,
  type CampaignLicenceContext,
} from "./CampaignFormFields";
import { UsageRightsPanel } from "./UsageRightsPanel";
import {
  CAMPAIGN_TYPES,
  isCampaignCalledOff,
  toIsoDate,
  type CampaignBrandOption,
} from "@/lib/campaigns";
import type { EditorVideoOption } from "@/lib/contentPlan";
import { renewalTotal } from "@/lib/usageRights";
import type { Campaign } from "@/repositories/campaigns";
import { notifyCreatedBrand } from "@/components/dashboard/createdBrandToast";

// Radix Select can't take "" as an item value, so "not linked" needs its own.
const NO_INVOICE_LINK = "__none__";

function latestRenewal(campaign: Campaign) {
  const { renewals } = campaign.usage;
  return renewals.length > 0 ? renewals[renewals.length - 1] : null;
}

function licenceContext(campaign: Campaign): CampaignLicenceContext {
  const renewal = latestRenewal(campaign);
  return {
    status: campaign.usage.status,
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
    reels: campaign.reels,
    story: campaign.story,
    status: campaign.status,
    amount: campaign.amount > 0 ? String(campaign.amount) : "",
    barterValue: campaign.barterValue > 0 ? String(campaign.barterValue) : "",
    paymentStatus: campaign.paymentStatus,
    date: toIsoDate(campaign.date) || new Date().toISOString().slice(0, 10),
    uploadDate: toIsoDate(campaign.uploadDate),
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
  invoiceOptions = [],
}: {
  campaign: Campaign;
  trigger: ReactNode;
  brandOptions?: CampaignBrandOption[];
  videoOptions?: EditorVideoOption[];
  /** The invoices this deal can be linked to. Left empty, the sheet offers no picker and keeps the link. */
  invoiceOptions?: CampaignInvoiceOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CampaignFormState>(() => formFromCampaign(campaign));
  const [invoiceId, setInvoiceId] = useState<string | null>(campaign.invoiceId);
  // Only invoices no other deal is linked to, plus this deal's own so the
  // picker can show it and unlink it. No choices left means no picker.
  const availableInvoices = invoiceOptions.filter(
    (option) => !option.linkedCampaignId || option.linkedCampaignId === campaign.id
  );
  const pickedInvoice = invoiceId ? availableInvoices.find((option) => option.id === invoiceId) : undefined;
  // The invoice the due date will be read from once saved. The picked one when
  // the sheet has a picker, so switching invoices shows the new date before
  // saving; otherwise the link already saved, which the read has applied.
  const dueInvoice: CampaignDueInvoice | null = pickedInvoice
    ? pickedInvoice.dueDate
      ? { number: pickedInvoice.number, dueDate: pickedInvoice.dueDate }
      : null
    : invoiceId && invoiceId === campaign.invoiceId && campaign.paymentDueFromInvoice
      ? { number: campaign.invoiceRef || "the linked invoice", dueDate: toIsoDate(campaign.paymentDue) }
      : null;
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isUnlinking, startUnlinkTransition] = useTransition();

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

  // Writes on click rather than on Save, like the licence panel below: undoing
  // a wrong link shouldn't wait on the rest of the form being valid.
  function unlinkInvoice() {
    startUnlinkTransition(async () => {
      const result = await unlinkCampaignInvoice(campaign.id);
      if (!result.success) {
        toast.error("Couldn't unlink the invoice", { description: result.error });
        return;
      }
      setInvoiceId(null);
      toast.success("Invoice unlinked");
      router.refresh();
    });
  }

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
        paymentDue: dueInvoice ? dueInvoice.dueDate : form.paymentDue,
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
        // Only from a sheet that offered the picker, so a sheet without one
        // can't unlink a deal it never showed the invoice for.
        ...(availableInvoices.length > 0 ? { invoiceId } : {}),
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
          setInvoiceId(campaign.invoiceId);
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
              dueInvoice={dueInvoice}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </form>

          {(invoiceHref || availableInvoices.length > 0) && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-xs font-medium">Invoice</p>
                    <p className="text-[11px] text-muted-foreground">
                      {campaign.invoiceId
                        ? "Already raised for this deal."
                        : "Fills in the brand, deliverables, amounts and due date from this deal as last saved."}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {invoiceHref && (
                      <Button asChild size="sm" variant="outline">
                        <Link href={invoiceHref}>
                          <FileText />
                          {campaign.invoiceId ? "View invoice" : "Create invoice"}
                        </Link>
                      </Button>
                    )}
                    {campaign.invoiceId && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            aria-label="Unlink invoice"
                            disabled={isUnlinking}
                            onClick={unlinkInvoice}
                          >
                            <Unlink />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Unlink invoice</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>

                {availableInvoices.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor={`${formId}-invoiceId`}>Linked invoice</Label>
                    <Select
                      value={invoiceId ?? NO_INVOICE_LINK}
                      onValueChange={(value) => setInvoiceId(value === NO_INVOICE_LINK ? null : value)}
                    >
                      <SelectTrigger id={`${formId}-invoiceId`} className="w-full">
                        <SelectValue placeholder="Not linked" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_INVOICE_LINK}>Not linked</SelectItem>
                        {availableInvoices.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            <span className="truncate">
                              {option.number}
                              {option.detail && ` · ${option.detail}`}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {invoiceId !== campaign.invoiceId && (
                      <p className="text-[11px] text-muted-foreground">
                        {pickedInvoice
                          ? `Saving links ${pickedInvoice.number} and shows it on the campaigns table.`
                          : "Saving unlinks the invoice from this deal."}
                      </p>
                    )}
                  </div>
                )}
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
