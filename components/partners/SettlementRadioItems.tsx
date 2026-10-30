"use client";

import { DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem } from "@/components/ui/dropdown-menu";
import { otherPartner, payerLabel, type Partner, type PartnerSettlement } from "@/lib/payers";

// Radix radio items can't take null as a value.
const UNDECIDED = "undecided";

interface SettlementRadioItemsProps {
  paidBy: Partner;
  settlement: PartnerSettlement | null;
  disabled?: boolean;
  onSettle: (settlement: PartnerSettlement | null) => void;
}

/** The three ways a cost a partner paid can stand, as one choice inside a row's menu. */
export function SettlementRadioItems({ paidBy, settlement, disabled = false, onSettle }: SettlementRadioItemsProps) {
  return (
    <>
      <DropdownMenuLabel className="text-[11px] text-muted-foreground">Paid by {payerLabel(paidBy)}</DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={settlement ?? UNDECIDED}
        onValueChange={(value) => onSettle(value === UNDECIDED ? null : (value as PartnerSettlement))}
      >
        <DropdownMenuRadioItem value="business" disabled={disabled}>
          Repay from business funds
        </DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="split" disabled={disabled}>
          Split 50/50 with {payerLabel(otherPartner(paidBy))}
        </DropdownMenuRadioItem>
        <DropdownMenuRadioItem value={UNDECIDED} disabled={disabled}>
          Decide later
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </>
  );
}
