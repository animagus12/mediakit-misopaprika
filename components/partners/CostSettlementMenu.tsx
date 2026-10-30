"use client";

import { Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Partner } from "@/lib/payers";
import { SettlementRadioItems } from "./SettlementRadioItems";
import { useSettleCost, type SettleableCost } from "./useSettleCost";

/**
 * How an editor payment a partner made is settled, from its row on Payments.
 * The job itself is edited in the Editor workspace; only this decision lives
 * here, since it is about the partners rather than the edit.
 */
export function CostSettlementMenu({ cost, paidBy }: { cost: SettleableCost; paidBy: Partner }) {
  const { settle, isPending } = useSettleCost();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" size="icon-sm" variant="ghost" aria-label="Settle between partners" disabled={isPending}>
          <Scale />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <SettlementRadioItems
          paidBy={paidBy}
          settlement={cost.settlement}
          disabled={isPending}
          onSettle={(settlement) => settle(cost, settlement)}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
