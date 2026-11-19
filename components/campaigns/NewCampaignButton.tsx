"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { createCampaign } from "@/app/(dashboard)/actions";
import { SheetFormFooter, SheetFormFooterFigure } from "@/components/common/SheetFormFooter";
import { PaymentFields } from "@/components/payments/PaymentFields";
import type { CampaignBrandOption } from "@/lib/campaigns";
import type { EditorVideoOption } from "@/lib/contentPlan";
import { todayKey } from "@/lib/day";
import { formatMoney } from "@/lib/invoice";
import { negativeAmountProblem, paymentFormFrom, paymentValuesFrom, withGross, type PaymentFormState } from "@/lib/paymentForm";
import { campaignTypeHasBarter, campaignTypeHasCash } from "@/repositories/campaigns";
import {
  CampaignFormFields,
  campaignAmounts,
  campaignInitialForm,
  campaignTotal,
  derivedPaymentStatus,
  focusBrandField,
} from "./CampaignFormFields";
import { notifyCreatedBrand } from "@/components/dashboard/createdBrandToast";

const FORM_ID = "new-campaign-form";
const FORM_ID_PREFIX = "new-campaign";

function blankPayment(): PaymentFormState {
  return paymentFormFrom(
    { date: todayKey(), gross: 0, tds: 0, bankFee: 0, method: null, reference: "", note: "" },
    "rate"
  );
}

interface CampaignOptions {
  brandOptions?: CampaignBrandOption[];
  videoOptions?: EditorVideoOption[];
}

export function NewCampaignButton({ brandOptions, videoOptions }: CampaignOptions) {
  const [open, setOpen] = useState(false);
  return (
    <NewCampaignSheet
      open={open}
      onOpenChange={setOpen}
      brandOptions={brandOptions}
      videoOptions={videoOptions}
      trigger={
        <Button size="sm">
          <Plus className="size-3.5" />
          New campaign
        </Button>
      }
    />
  );
}

interface NewCampaignSheetProps extends CampaignOptions {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The button that opens it, when it has one. The shell's New menu opens it without. */
  trigger?: React.ReactElement;
}

// Controlled, so the page's own button and the shell's New menu open the one
// form rather than two copies that could drift apart.
export function NewCampaignSheet({
  open,
  onOpenChange,
  trigger,
  brandOptions = [],
  videoOptions = [],
}: NewCampaignSheetProps) {
  const router = useRouter();
  const [form, setForm] = useState(campaignInitialForm);
  // A deal whose money has already landed is entered with that payment, so it
  // is on the books from the start rather than as a status nobody can date.
  const [received, setReceived] = useState(false);
  const [payment, setPayment] = useState<PaymentFormState>(blankPayment);
  const [paymentId, setPaymentId] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);
  // Set by a save refused for want of a brand, so the field says so; naming
  // one clears it.
  const [brandMissing, setBrandMissing] = useState(false);
  const [isPending, startTransition] = useTransition();

  const hasCash = campaignTypeHasCash(form.type);
  const { amount, usageFee } = campaignAmounts(form);
  const cash = amount + usageFee;
  const expectedRate = form.tdsRate.trim() ? Number(form.tdsRate) : null;
  // The payment settles the whole deal, so its amount is the deal's cash.
  const settledPayment = withGross(payment, String(cash), expectedRate);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!form.brand.trim()) {
      setBrandMissing(true);
      focusBrandField(FORM_ID_PREFIX);
      return;
    }
    const recordReceived = received && hasCash;
    if (recordReceived) {
      if (cash <= 0) {
        setError("Enter the amount before recording it as received");
        return;
      }
      const amountProblem = negativeAmountProblem(settledPayment);
      if (amountProblem) {
        setError(amountProblem);
        return;
      }
    }
    startTransition(async () => {
      const result = await createCampaign(
        {
          brand: form.brand.trim(),
          brandId: form.brandId,
          campaign: form.campaign.trim(),
          type: form.type,
          reels: form.reels,
          reelTypes: form.reelTypes,
          story: form.story,
          status: form.status,
          ...campaignAmounts(form),
          // Not asked for: a deal being struck has nothing to say about payment
          // beyond the dates on it. See derivedPaymentStatus.
          paymentStatus: recordReceived ? "pending" : derivedPaymentStatus(form),
          ...(hasCash && campaignTypeHasBarter(form.type) ? { barterStatus: form.barterStatus } : {}),
          date: form.date,
          uploadDate: form.uploadDate,
          paymentDue: form.paymentDue,
          paidDate: form.paidDate,
          paymentMethod: form.paymentMethod.trim(),
          tdsRate: form.tdsRate.trim() ? Number(form.tdsRate) : null,
          tdsAmount: hasCash ? null : form.tdsAmount.trim() ? Number(form.tdsAmount) : null,
          editorTransactionId: form.editorTransactionId,
          usageDays: Number(form.usageDays) || 0,
          usageIndefinite: form.usageIndefinite,
        },
        recordReceived ? paymentValuesFrom(settledPayment, paymentId) : undefined
      );
      if (!result.success) {
        setError(result.error);
        return;
      }
      if (result.warning) toast.warning("Campaign added", { description: result.warning });
      notifyCreatedBrand(result.createdBrand, router);
      setForm(campaignInitialForm());
      setReceived(false);
      setPayment(blankPayment());
      handleOpenChange(false);
    });
  }

  // Reset on the way out rather than on the way in: an opening from the New
  // menu sets `open` directly and never passes through here, and each opening
  // still has to find no stale error and a payment id of its own.
  function handleOpenChange(next: boolean) {
    if (!next) {
      setError(null);
      setBrandMissing(false);
      setPaymentId(crypto.randomUUID());
    }
    onOpenChange(next);
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      {trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}
      <SheetContent className="flex flex-col gap-0 data-[side=right]:sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>New campaign</SheetTitle>
          <SheetDescription>Records a deal as it was agreed.</SheetDescription>
        </SheetHeader>

        <form
          id={FORM_ID}
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-6 pb-6"
        >
          <CampaignFormFields
            idPrefix={FORM_ID_PREFIX}
            mode="create"
            form={form}
            setForm={setForm}
            brandOptions={brandOptions}
            videoOptions={videoOptions}
            brandError={brandMissing && !form.brand.trim()}
            paymentSlot={
              hasCash ? (
                <div className="flex flex-col gap-4 rounded-lg border border-border p-4">
                  <Field orientation="horizontal">
                    <Switch
                      id="new-campaign-received"
                      checked={received}
                      onCheckedChange={setReceived}
                    />
                    <FieldContent>
                      <FieldLabel htmlFor="new-campaign-received">Already received</FieldLabel>
                      <FieldDescription>Record the payment now, with its TDS and charges.</FieldDescription>
                    </FieldContent>
                  </Field>
                  {received && (
                    <PaymentFields
                      idPrefix="new-campaign-payment"
                      form={settledPayment}
                      onChange={setPayment}
                      expectedTdsRate={expectedRate}
                      grossLocked
                    />
                  )}
                </div>
              ) : undefined
            }
          />
        </form>

        <SheetFormFooter
          formId={FORM_ID}
          submitLabel={received && hasCash ? "Add and record payment" : "Add campaign"}
          pendingLabel="Adding…"
          isPending={isPending}
          error={error}
          summary={<SheetFormFooterFigure value={formatMoney(campaignTotal(form))} label="deal total" />}
        />
      </SheetContent>
    </Sheet>
  );
}
