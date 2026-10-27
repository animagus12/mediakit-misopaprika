"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { MoreHorizontal, Plus } from "lucide-react";
import { deletePayment } from "@/app/payments/actions";
import { restoreTrashItem } from "@/app/trash/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toSheetDate } from "@/lib/campaigns";
import { formatMoney } from "@/lib/invoice";
import { payerLabel, type Payer } from "@/lib/payers";
import { ledgerWarnings, settlementLabel, settlementSummary } from "@/lib/payments";
import { cn } from "@/lib/utils";
import type { LedgerEntry, Settlement } from "@/repositories/payments";
import { RecordPaymentSheet } from "./RecordPaymentSheet";

const STATUS_TONES: Record<Settlement["status"], string> = {
  paid: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  partial: "border-teal-500/30 bg-teal-500/10 text-teal-700 dark:bg-teal-500/15 dark:text-teal-400",
  pending: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  unknown: "text-muted-foreground",
};

interface PaymentHistoryProps {
  settlement: Settlement;
  /** "IG Page", "IG Page · renewal R0002": names the target in sheets and toasts. */
  targetLabel: string;
  expectedTdsRate: number | null;
  /** Tighter spacing, for a row inside a list rather than a section of its own. */
  compact?: boolean;
  /** Read only: shows the payments without record, edit or delete (a linked invoice's view of its deal). */
  readOnly?: boolean;
}

// Whose account a new payment starts on: where this target's last payment
// landed, else Business funds.
function defaultReceivedInto(settlement: Settlement): Payer {
  for (let index = settlement.entries.length - 1; index >= 0; index -= 1) {
    const into = settlement.entries[index].receivedInto;
    if (into) return into;
  }
  return "business";
}

function entryDetail(entry: LedgerEntry): string[] {
  const parts = [`TDS ${formatMoney(entry.tds)}`];
  if (entry.bankFee > 0) parts.push(`Charges ${formatMoney(entry.bankFee)}`);
  parts.push(`Net ${formatMoney(entry.net)}`);
  return parts;
}

function entrySource(entry: LedgerEntry): string {
  const parts = [entry.receivedInto ? payerLabel(entry.receivedInto) : "Account not recorded"];
  if (entry.method) parts.push(entry.method);
  if (entry.reference) parts.push(entry.reference);
  return parts.join(" · ");
}

/**
 * The payments recorded against one deal, renewal or invoice, with what is
 * still owed and the actions to record, edit or delete one.
 *
 * Payments entered before the ledger read from the deal's or invoice's own
 * fields and are marked "From earlier record": editing or deleting one turns
 * it into a recorded payment first (see paymentLedger.server.ts).
 */
export function PaymentHistory({ settlement, targetLabel, expectedTdsRate, compact = false, readOnly = false }: PaymentHistoryProps) {
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState<LedgerEntry | null>(null);
  const warnings = ledgerWarnings({ settlement });
  const receivedInto = defaultReceivedInto(settlement);

  function remove(entry: LedgerEntry) {
    startTransition(async () => {
      const result = await deletePayment(entry.id);
      if (!result.success) {
        toast.error("Couldn't delete the payment", { description: result.error });
        return;
      }
      toast.success("Payment moved to Trash", {
        description: result.warning ?? `${formatMoney(entry.gross)} for ${targetLabel}`,
        action: {
          label: "Undo",
          onClick: () =>
            startTransition(async () => {
              const undo = await restoreTrashItem(result.trashId);
              if (!undo.success) toast.error("Couldn't undo", { description: undo.error });
            }),
        },
      });
    });
  }

  return (
    <div className={cn("min-w-0", compact ? "space-y-2" : "space-y-3")}>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Badge variant="outline" className={STATUS_TONES[settlement.status]}>
          {settlementLabel(settlement)}
        </Badge>
        {settlement.owed > 0 && (
          <span className="text-xs text-muted-foreground tabular-nums">{settlementSummary(settlement)}</span>
        )}
        {settlement.overpaid > 0 && (
          <Badge variant="outline" className={STATUS_TONES.pending}>
            {formatMoney(settlement.overpaid)} over
          </Badge>
        )}
      </div>
      {warnings.map((warning) => (
        <p key={warning.code} className="text-[11px] text-amber-700 dark:text-amber-400">
          {warning.message}
        </p>
      ))}

      {settlement.entries.length === 0 ? (
        <p className="text-xs text-muted-foreground">No payments recorded yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {settlement.entries.map((entry) => (
            <li
              key={entry.id}
              className={cn(
                "flex min-w-0 items-start gap-2 rounded-md border border-border/60 bg-muted/20",
                compact ? "px-2 py-1.5" : "px-3 py-2"
              )}
            >
              <div className="min-w-0 flex-1 space-y-0.5 text-xs">
                <div className="flex min-w-0 items-baseline justify-between gap-2">
                  <span className={cn("truncate", !entry.date && "text-muted-foreground")}>
                    {entry.date ? toSheetDate(entry.date) : "Date not recorded"}
                  </span>
                  <span className="shrink-0 font-medium tabular-nums">{formatMoney(entry.gross)}</span>
                </div>
                {/* Wraps between figures rather than truncating: the net at its end is the one that matters. */}
                <p className="text-muted-foreground tabular-nums">
                  {entryDetail(entry).map((part, index) => (
                    <span key={part}>
                      {index > 0 && " · "}
                      <span className="whitespace-nowrap">{part}</span>
                    </span>
                  ))}
                </p>
                <p className="truncate text-muted-foreground" title={entrySource(entry)}>
                  {entrySource(entry)}
                </p>
                {entry.origin === "legacy" && (
                  <Badge variant="outline" className="mt-1 text-[10px]">
                    From earlier record
                  </Badge>
                )}
              </div>
              {!readOnly && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" size="icon-sm" variant="ghost" aria-label="Payment actions" disabled={isPending}>
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setEditing(entry)}>Edit</DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onSelect={() => remove(entry)}>
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Outside the menu, keyed by the entry: a sheet mounted inside the
          menu would unmount the moment the menu closed. */}
      {editing && (
        <RecordPaymentSheet
          key={editing.id}
          settlement={settlement}
          targetLabel={targetLabel}
          expectedTdsRate={expectedTdsRate}
          entry={editing}
          defaultReceivedInto={receivedInto}
          open
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
        />
      )}

      {!readOnly && settlement.remaining > 0 && (
        <RecordPaymentSheet
          settlement={settlement}
          targetLabel={targetLabel}
          expectedTdsRate={expectedTdsRate}
          defaultReceivedInto={receivedInto}
          trigger={
            <Button type="button" size="sm" variant="outline">
              <Plus />
              Record payment
            </Button>
          }
        />
      )}
    </div>
  );
}
