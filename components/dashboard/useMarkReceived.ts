"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import {
  markCampaignPaymentReceived,
  unmarkCampaignPaymentReceived,
} from "@/app/(dashboard)/actions";

// Shared "mark a payment received" behaviour for PaymentsDueCard and
// NeedsAttentionCard: the row vanishes the instant it's clicked (optimistic),
// the write happens in the background, and the success toast carries an
// Undo that puts payment status back to pending. On failure the optimistic
// hide reverts itself when the transition ends, so the row simply reappears.
//
// Marking received also moves the deal's linked invoice to "paid". The Undo
// carries the status that invoice held beforehand, so reverting restores it
// exactly rather than assuming it was "sent".
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

      const undoAction = {
        label: "Undo",
        onClick: () =>
          startTransition(async () => {
            const undo = await unmarkCampaignPaymentReceived(campaignId, result.previousInvoiceStatus);
            if (!undo.success) toast.error("Couldn't undo", { description: undo.error });
          }),
      };

      // The payment landed either way; the warning is about the invoice not
      // following, which is worth saying rather than showing a plain success.
      if (result.warning) {
        toast.warning(`${label}: marked received`, {
          description: `The linked invoice wasn't updated: ${result.warning}`,
          action: undoAction,
        });
        return;
      }

      toast.success(`${label}: marked received`, {
        description: result.previousInvoiceStatus ? "Linked invoice marked paid." : undefined,
        action: undoAction,
      });
    });
  }

  return { hiddenIds, isPending, markReceived };
}
