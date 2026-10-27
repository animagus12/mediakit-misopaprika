"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { linkInvoiceToCampaign } from "@/app/(dashboard)/actions";
import { PaymentHistory } from "@/components/payments/PaymentHistory";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { InvoiceDealOption } from "@/lib/invoice";
import type { Invoice } from "@/repositories/invoices";
import type { Settlement } from "@/repositories/payments";

interface StandaloneInvoicePaymentsProps {
  invoiceId: string;
  settlement: Settlement;
  invoice: Pick<Invoice, "status" | "storedStatus" | "subtotal" | "owner">;
  /** "Invoice MSP-INV-0009" */
  label: string;
  /** Deals this invoice could bill; empty skips the question. */
  dealOptions: InvoiceDealOption[];
}

/**
 * The payments of an invoice that bills no deal, recorded against the invoice
 * itself.
 *
 * Before its first payment it asks whether it bills a deal after all: money
 * for a deal belongs on the deal, or the deal would read unpaid while the
 * invoice reads paid, and linking the two later would have to move it.
 */
export function StandaloneInvoicePayments({
  invoiceId,
  settlement,
  invoice,
  label,
  dealOptions,
}: StandaloneInvoicePaymentsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // The opener of the payment sheet the question is holding back, while asked.
  const [pendingRecord, setPendingRecord] = useState<(() => void) | null>(null);
  const [dealId, setDealId] = useState("");

  function beforeRecord(proceed: () => void) {
    if (settlement.hasStored || dealOptions.length === 0) {
      proceed();
      return;
    }
    setDealId("");
    // Wrapped: a function handed to a state setter would be called as an updater.
    setPendingRecord(() => proceed);
  }

  function recordStandalone() {
    const proceed = pendingRecord;
    setPendingRecord(null);
    proceed?.();
  }

  function linkDeal() {
    const deal = dealOptions.find((option) => option.id === dealId);
    if (!deal) return;
    startTransition(async () => {
      const result = await linkInvoiceToCampaign(invoiceId, deal.id);
      if (!result.success) {
        toast.error("Couldn't link the deal", { description: result.error });
        return;
      }
      setPendingRecord(null);
      toast.success(`Linked to ${deal.label}`, {
        description: "Record the payment in the deal's Payments, shown on this page.",
      });
      router.refresh();
    });
  }

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-border p-3">
      <p className="text-xs font-medium">Payments</p>
      <p className="text-[11px] text-muted-foreground">This invoice reads Paid once they cover its total.</p>
      <PaymentHistory
        settlement={settlement}
        targetLabel={label}
        expectedTdsRate={null}
        compact
        warningContext={{ invoice }}
        beforeRecord={beforeRecord}
      />

      <AlertDialog
        open={pendingRecord !== null}
        onOpenChange={(open) => {
          if (!open && !isPending) setPendingRecord(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Does this invoice bill a deal?</AlertDialogTitle>
            <AlertDialogDescription>
              Money for a deal is recorded on the deal, so its figures stay right. Link it now, or record the
              payment on this invoice alone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="invoice-deal">Deal</Label>
            <Select value={dealId} onValueChange={setDealId}>
              <SelectTrigger id="invoice-deal" className="w-full min-w-0">
                <SelectValue placeholder="Pick the deal it bills" />
              </SelectTrigger>
              <SelectContent>
                {dealOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <Button type="button" variant="outline" onClick={recordStandalone} disabled={isPending}>
              No, it&apos;s standalone
            </Button>
            <Button type="button" onClick={linkDeal} disabled={isPending || !dealId}>
              {isPending ? "Linking…" : "Link deal"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
