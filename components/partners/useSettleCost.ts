"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { settlePartnerCost } from "@/app/partners/actions";
import { partnerSettlementLabel, type PartnerSettlement } from "@/lib/payers";

export interface SettleableCost {
  source: "expense" | "editing";
  id: string;
  /** Named in the toast: "Hot Wheels set". */
  label: string;
  /** How it is settled now, for Undo. */
  settlement: PartnerSettlement | null;
}

/**
 * Settles a cost a partner paid, from wherever it is listed. The toast says
 * what was decided and carries an Undo that puts the previous choice back.
 */
export function useSettleCost() {
  const [isPending, startTransition] = useTransition();

  function settle(cost: SettleableCost, settlement: PartnerSettlement | null) {
    if (settlement === cost.settlement) return;
    startTransition(async () => {
      const result = await settlePartnerCost({ source: cost.source, id: cost.id, settlement });
      if (!result.success) {
        toast.error("Couldn't settle it", { description: result.error });
        return;
      }
      toast.success(`${cost.label}: ${partnerSettlementLabel(settlement).toLowerCase()}`, {
        action: {
          label: "Undo",
          onClick: () =>
            startTransition(async () => {
              const undo = await settlePartnerCost({ source: cost.source, id: cost.id, settlement: cost.settlement });
              if (!undo.success) toast.error("Couldn't undo", { description: undo.error });
            }),
        },
      });
    });
  }

  return { settle, isPending };
}
