"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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
import { PaymentFields } from "@/components/payments/PaymentFields";
import type { CampaignBrandOption } from "@/lib/campaigns";
import type { EditorVideoOption } from "@/lib/contentPlan";
import { todayKey } from "@/lib/day";
import { hasNegativeCharges, paymentFormFrom, paymentValuesFrom, withGross, type PaymentFormState } from "@/lib/paymentForm";
import { campaignTypeHasBarter, campaignTypeHasCash } from "@/repositories/campaigns";
import {
  CampaignFormFields,
  campaignAmounts,
  campaignInitialForm,
  derivedPaymentStatus,
} from "./CampaignFormFields";
import { notifyCreatedBrand } from "@/components/dashboard/createdBrandToast";

function blankPayment(): PaymentFormState {
  return paymentFormFrom(
    { date: todayKey(), gross: 0, tds: 0, bankFee: 0, receivedInto: "business", method: null, reference: "", note: "" },
    false
  );
}

export function NewCampaignButton({
  brandOptions = [],
  videoOptions = [],
}: {
  brandOptions?: CampaignBrandOption[];
  videoOptions?: EditorVideoOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(campaignInitialForm);
  // A deal whose money has already landed is entered with that payment, so it
  // is on the books from the start rather than as a status nobody can date.
  const [received, setReceived] = useState(false);
  const [payment, setPayment] = useState<PaymentFormState>(blankPayment);
  const [paymentId, setPaymentId] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);
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
    const recordReceived = received && hasCash;
    if (recordReceived) {
      if (cash <= 0) {
        setError("Enter the amount before recording it as received");
        return;
      }
      if (hasNegativeCharges(settledPayment)) {
        setError("Net received can't be more than the amount less TDS");
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
      setOpen(false);
    });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setError(null);
          setPaymentId(crypto.randomUUID());
        }
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
            Records a deal as it was agreed. What it only learns later, when the money lands or
            the post goes up, is folded away at the bottom.
          </SheetDescription>
        </SheetHeader>

        <form
          id="new-campaign-form"
          onSubmit={handleSubmit}
          className="flex-1 space-y-4 overflow-y-auto px-6"
        >
          <CampaignFormFields
            idPrefix="new-campaign"
            mode="create"
            form={form}
            setForm={setForm}
            brandOptions={brandOptions}
            videoOptions={videoOptions}
            paymentSlot={
              <div className="space-y-3 rounded-lg border border-border p-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="new-campaign-received"
                    checked={received}
                    onCheckedChange={(checked) => setReceived(checked === true)}
                  />
                  <Label htmlFor="new-campaign-received">Already received</Label>
                </div>
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
            }
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
