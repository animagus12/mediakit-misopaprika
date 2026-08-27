"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import {
  markCampaignPaymentReceived,
  unmarkCampaignPaymentReceived,
} from "@/app/(dashboard)/actions";

// Shared "mark a payment received" behaviour for PaymentsDueCard and
// NeedsAttentionCard: the row vanishes the instant it's clicked (optimistic),
// the sheet write happens in the background, and the success toast carries an
// Undo that puts the Payment cell back to pending. On failure the optimistic
// hide reverts itself when the transition ends, so the row simply reappears.
export function useMarkReceived() {
  const [isPending, startTransition] = useTransition();
  const [hiddenIds, hide] = useOptimistic<string[], string>([], (ids, id) => [...ids, id]);

  function markReceived(campaignId: string, label: string) {
    startTransition(async () => {
      hide(campaignId);
      const result = await markCampaignPaymentReceived(campaignId);
      if (!result.success) {
        toast.error("Couldn't mark received", { description: result.error });
        return;
      }
      toast.success(`${label} — marked received`, {
        action: {
          label: "Undo",
          onClick: () =>
            startTransition(async () => {
              const undo = await unmarkCampaignPaymentReceived(campaignId);
              if (!undo.success) toast.error("Couldn't undo", { description: undo.error });
            }),
        },
      });
    });
  }

  return { hiddenIds, isPending, markReceived };
}
