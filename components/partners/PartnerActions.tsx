"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteSettleUp } from "@/app/partners/actions";
import { restoreTrashItem } from "@/app/trash/actions";
import { showUndoToast } from "@/components/common/undo-toast";
import { Button } from "@/components/ui/button";
import { otherPartner, payerLabel, type Partner } from "@/lib/payers";
import { SettleUpSheet, type SettleUpDefaults } from "./SettleUpSheet";
import { useSettleCost, type SettleableCost } from "./useSettleCost";

/** Opens the settle-up form, on a balance when it is given one. */
export function SettleUpButton({
  defaults,
  label = "Settle up",
  variant = "outline",
}: {
  defaults: SettleUpDefaults;
  label?: string;
  variant?: "outline" | "ghost";
}) {
  // A fresh key per opening, so each settle-up gets a new id.
  const [openKey, setOpenKey] = useState<number | null>(null);
  return (
    <>
      <Button type="button" size="sm" variant={variant} onClick={() => setOpenKey(Date.now())}>
        {label}
      </Button>
      {openKey !== null && <SettleUpSheet key={openKey} defaults={defaults} onClose={() => setOpenKey(null)} />}
    </>
  );
}

/** The two ways to settle a cost a partner paid, as buttons on its row. */
export function SettleCostButtons({ cost, paidBy }: { cost: SettleableCost; paidBy: Partner }) {
  const { settle, isPending } = useSettleCost();
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => settle(cost, "business")}>
        Repay from business funds
      </Button>
      <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => settle(cost, "split")}>
        Split 50/50 with {payerLabel(otherPartner(paidBy))}
      </Button>
    </div>
  );
}

/** Deletes a settle-up to Trash, with Undo. */
export function DeleteSettleUpButton({ id, label }: { id: string; label: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      size="icon-sm"
      variant="ghost"
      aria-label={`Delete settle-up: ${label}`}
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await deleteSettleUp(id);
          showUndoToast(`Settle-up ${label}`, result, restoreTrashItem);
        })
      }
    >
      <Trash2 />
    </Button>
  );
}
