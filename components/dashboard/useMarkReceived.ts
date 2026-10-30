"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { markTargetReceived, undoMarkReceived } from "@/app/payments/actions";
import { formatMoney } from "@/lib/invoice";
import { paymentTargetKey, type PaymentTarget } from "@/repositories/payments";

// Shared one-click "received" for PaymentsDueCard, NeedsAttentionCard and the
// renewals card: the row vanishes the instant it's clicked (optimistic), and
// a payment for everything still owed is recorded in the background, dated
// today, with TDS at the expected rate and the method last used for the
// brand. The toast says what was recorded and carries an Undo that removes
// exactly that payment. On failure the optimistic hide reverts itself when the
// transition ends, so the row simply reappears.
//
// The id is made here, once per click, so a double tap records one payment.
export function useMarkReceived() {
  const [isPending, startTransition] = useTransition();
  const [hiddenKeys, hide] = useOptimistic<string[], string>([], (keys, key) => [...keys, key]);

  function markReceived(target: PaymentTarget, label: string) {
    const clientId = crypto.randomUUID();
    startTransition(async () => {
      hide(paymentTargetKey(target));
      const result = await markTargetReceived(target, clientId);
      if (!result.success) {
        toast.error("Couldn't mark received", { description: result.error });
        return;
      }

      const undoAction = {
        label: "Undo",
        onClick: () =>
          startTransition(async () => {
            const undo = await undoMarkReceived(result.paymentId);
            if (!undo.success) toast.error("Couldn't undo", { description: undo.error });
          }),
      };
      const title = `${label}: ${formatMoney(result.gross)} received`;
      const description = "Edit it from the deal's Payments section.";

      if (result.warning) {
        toast.warning(title, { description: result.warning, action: undoAction });
        return;
      }
      toast.success(title, { description, action: undoAction });
    });
  }

  const isHidden = (target: PaymentTarget) => hiddenKeys.includes(paymentTargetKey(target));

  return { isHidden, isPending, markReceived };
}
