"use client";

import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { setUsageRenewalTds } from "@/app/(dashboard)/actions";
import { formatMoney } from "@/lib/invoice";
import { parseTdsInput } from "@/lib/tds";
import { formatUsageDays } from "@/lib/usageRights";
import type { UsageRenewalRecord } from "@/repositories/campaigns";
import { TdsFields } from "./TdsFields";

interface RenewalTdsSheetProps {
  campaignId: string;
  brand: string;
  renewal: UsageRenewalRecord;
  trigger: ReactNode;
}

function toInput(value: number | null): string {
  return value === null ? "" : String(value);
}

/**
 * Records the TDS withheld from a renewal that is already on the books.
 *
 * The rest of a renewal is fixed once recorded (see UsageRightsPanel), but the
 * tax is often only known once the money lands or the brand's certificate
 * arrives, and every renewal recorded before TDS was tracked on them needs a
 * way to get it. Clearing both fields removes the record.
 */
export function RenewalTdsSheet({ campaignId, brand, renewal, trigger }: RenewalTdsSheetProps) {
  const [open, setOpen] = useState(false);
  const [rate, setRate] = useState(() => toInput(renewal.tdsRate));
  const [amount, setAmount] = useState(() => toInput(renewal.tdsAmount));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const formId = `renewal-tds-${campaignId}-${renewal.id}`;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await setUsageRenewalTds(campaignId, renewal.id, {
        tdsRate: parseTdsInput(rate),
        tdsAmount: parseTdsInput(amount),
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setOpen(false);
      toast.success(`${brand}: renewal TDS saved`);
    });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Reseeded on open so a sheet left mounted shows what is stored now.
        if (next) {
          setRate(toInput(renewal.tdsRate));
          setAmount(toInput(renewal.tdsAmount));
          setError(null);
        }
      }}
    >
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="flex flex-col gap-0">
        <SheetHeader>
          <SheetTitle>Renewal TDS</SheetTitle>
          <SheetDescription>
            {brand}: {formatUsageDays(renewal.days)} from {renewal.startDate},{" "}
            {formatMoney(renewal.amount)}.
          </SheetDescription>
        </SheetHeader>

        <form id={formId} onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto px-6">
          <TdsFields
            idPrefix={formId}
            rate={rate}
            amount={amount}
            onRateChange={setRate}
            onAmountChange={setAmount}
            gross={renewal.amount}
            description="Track the tax deducted from this renewal's fee. Clear both fields to remove it."
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </form>

        <SheetFooter className="flex-row">
          <SheetClose asChild>
            <Button type="button" variant="outline" className="flex-1">
              Cancel
            </Button>
          </SheetClose>
          <Button type="submit" form={formId} className="flex-1" disabled={isPending}>
            {isPending ? "Saving…" : "Save TDS"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
