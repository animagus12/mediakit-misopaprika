"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateCampaign } from "@/app/(dashboard)/actions";
import { STATUS_OPTIONS, CAMPAIGN_TYPES, toIsoDate } from "@/lib/campaigns";
import { cn } from "@/lib/utils";
import type { Campaign, CampaignStatus } from "@/repositories/campaigns";

interface CampaignStatusSelectProps {
  campaign: Campaign;
  className?: string;
}

// Advance a deal through the pipeline straight from its dashboard card,
// without opening the full edit sheet. The Select reflects the new stage
// instantly (optimistic) while the update runs; the success toast carries an
// Undo that moves it back. Writes the same CampaignFormUpdate the sheet does
// (every other field carried through unchanged), so the two stay
// interchangeable. Type is coerced to a valid option the same way
// EditCampaignSheet does it. The status needs no such care: the store reads
// every record into the shared vocabulary, so it is always one of the options.
export function CampaignStatusSelect({
  campaign,
  className,
}: CampaignStatusSelectProps) {
  const [isPending, startTransition] = useTransition();
  const [status, setOptimisticStatus] = useOptimistic(campaign.status);

  function move(nextStatus: CampaignStatus, previousStatus: CampaignStatus, isUndo: boolean) {
    startTransition(async () => {
      setOptimisticStatus(nextStatus);

      const type = CAMPAIGN_TYPES.includes(
        campaign.type as (typeof CAMPAIGN_TYPES)[number]
      )
        ? (campaign.type as (typeof CAMPAIGN_TYPES)[number])
        : "Barter";

      const result = await updateCampaign({
        id: campaign.id,
        brand: campaign.brand,
        brandId: campaign.brandId,
        campaign: campaign.campaign,
        type,
        reels: campaign.reels,
        story: campaign.story,
        status: nextStatus,
        amount: campaign.amount,
        barterValue: campaign.barterValue,
        paymentStatus: campaign.paymentStatus,
        date: toIsoDate(campaign.date) || new Date().toISOString().slice(0, 10),
        uploadDate: toIsoDate(campaign.uploadDate),
        invoiceRef: campaign.invoiceRef,
        paymentDue: toIsoDate(campaign.paymentDue),
        paidDate: toIsoDate(campaign.paidDate),
        paymentMethod: campaign.paymentMethod,
        usageDays: campaign.usage.days,
        usageIndefinite: campaign.usage.indefinite,
        usageFee: campaign.usage.fee,
      });

      if (!result.success) {
        toast.error("Couldn't update status", { description: result.error });
        return;
      }
      if (!isUndo) {
        toast.success(`${campaign.brand} → ${nextStatus}`, {
          action: {
            label: "Undo",
            onClick: () => move(previousStatus, nextStatus, true),
          },
        });
      }
    });
  }

  function handleChange(nextStatus: string) {
    if (nextStatus === status) return;
    move(nextStatus as CampaignStatus, status, false);
  }

  return (
    <Select value={status} onValueChange={handleChange} disabled={isPending}>
      <SelectTrigger size="sm" aria-label="Change status" className={cn("max-w-[9.5rem]", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUS_OPTIONS.map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
