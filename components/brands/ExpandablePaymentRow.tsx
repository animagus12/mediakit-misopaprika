"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { PaymentHistory } from "@/components/payments/PaymentHistory";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { Settlement } from "@/repositories/payments";

interface ExpandablePaymentRowProps {
  /** Names the row for screen readers and the payment sheet: "Launch", "Launch · usage renewal". */
  label: string;
  /** Null on a barter-only deal, which has no payments and so no toggle. */
  settlement: Settlement | null;
  expectedTdsRate: number | null;
  /** Every column, the toggle's included, for the payments row to span. */
  colSpan: number;
  /** The row's other cells, rendered on the server. */
  children: ReactNode;
}

/**
 * A row of the brand's payments table that opens onto its payments, where
 * they can be recorded, edited or deleted without leaving the brand.
 *
 * The opened panel is pinned to the left of the table's scroll area and no
 * wider than the screen, so on a phone it stays in view however far the
 * table itself scrolls sideways.
 */
export function ExpandablePaymentRow({ label, settlement, expectedTdsRate, colSpan, children }: ExpandablePaymentRowProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <>
      <TableRow>
        <TableCell className="w-8 pr-0">
          {settlement && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-expanded={open}
              aria-controls={panelId}
              aria-label={`${open ? "Hide" : "Show"} payments for ${label}`}
              onClick={() => setOpen((value) => !value)}
            >
              <ChevronRight className={cn("transition-transform", open && "rotate-90")} />
            </Button>
          )}
        </TableCell>
        {children}
      </TableRow>
      {open && settlement && (
        <TableRow id={panelId} className="bg-muted/20 hover:bg-muted/20">
          <TableCell colSpan={colSpan} className="whitespace-normal">
            <div className="sticky left-2 w-[min(26rem,calc(100vw-4.5rem))]">
              <PaymentHistory settlement={settlement} targetLabel={label} expectedTdsRate={expectedTdsRate} compact />
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
