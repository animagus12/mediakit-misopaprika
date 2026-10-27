"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { deletePayment } from "@/app/payments/actions";
import { Button } from "@/components/ui/button";
import { toSheetDate } from "@/lib/campaigns";
import { formatMoney } from "@/lib/invoice";
import type { PaymentRecord, PaymentTarget } from "@/repositories/payments";

function targetName(target: PaymentTarget): string {
  switch (target.kind) {
    case "deal":
      return `Deal ${target.campaignId}`;
    case "renewal":
      return `Renewal ${target.renewalId} of deal ${target.campaignId}`;
    case "invoice":
      return "An invoice";
  }
}

/**
 * Payments still on the books against a deal, renewal or invoice that no
 * longer exists, so no other page shows them. Each can be moved to Trash.
 */
export function UnlinkedPayments({ payments }: { payments: PaymentRecord[] }) {
  const [isPending, startTransition] = useTransition();

  function remove(payment: PaymentRecord) {
    startTransition(async () => {
      const result = await deletePayment(payment.id);
      if (!result.success) {
        toast.error("Couldn't delete the payment", { description: result.error });
        return;
      }
      toast.success("Payment moved to Trash", { description: `${formatMoney(payment.gross)} with no deal` });
    });
  }

  return (
    <ul className="space-y-2">
      {payments.map((payment) => (
        <li
          key={payment.id}
          className="flex min-w-0 items-start gap-3 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs"
        >
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex min-w-0 items-baseline justify-between gap-2">
              <span className="truncate">{payment.date ? toSheetDate(payment.date) : "Date not recorded"}</span>
              <span className="shrink-0 font-medium tabular-nums">{formatMoney(payment.gross)}</span>
            </div>
            <p className="truncate text-muted-foreground">{targetName(payment.target)}, now deleted</p>
            <p className="truncate text-muted-foreground">
              {[payment.method ?? "Method not recorded", payment.reference].filter(Boolean).join(" · ")}
            </p>
          </div>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="Delete payment"
            disabled={isPending}
            onClick={() => remove(payment)}
          >
            <Trash2 />
          </Button>
        </li>
      ))}
    </ul>
  );
}
