"use client";

import { useState, useTransition } from "react";
import { MoreHorizontal, Plus } from "lucide-react";
import { deleteExpense } from "@/app/expenses/actions";
import { restoreTrashItem } from "@/app/trash/actions";
import { showUndoToast } from "@/components/common/undo-toast";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SettlementRadioItems } from "@/components/partners/SettlementRadioItems";
import { useSettleCost } from "@/components/partners/useSettleCost";
import { isPartner } from "@/lib/payers";
import type { ExpenseFormDefaults } from "@/lib/expenseForm";
import type { ExpenseDealOption } from "@/lib/expenses";
import type { ExpenseRecord } from "@/repositories/expenses";
import { ExpenseSheet } from "./ExpenseSheet";

interface AddExpenseButtonProps {
  dealOptions: ExpenseDealOption[];
  defaults: ExpenseFormDefaults;
  label?: string;
}

/** Opens a fresh expense form, on the deal in `defaults` when it is added from one. */
export function AddExpenseButton({ dealOptions, defaults, label = "Add expense" }: AddExpenseButtonProps) {
  // A fresh key per opening, so each form starts empty and with a new id.
  const [openKey, setOpenKey] = useState<number | null>(null);
  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpenKey(Date.now())}>
        <Plus />
        {label}
      </Button>
      {openKey !== null && (
        <ExpenseSheet key={openKey} dealOptions={dealOptions} defaults={defaults} onClose={() => setOpenKey(null)} />
      )}
    </>
  );
}

interface ExpenseRowMenuProps {
  expense: ExpenseRecord;
  dealOptions: ExpenseDealOption[];
  defaults: ExpenseFormDefaults;
}

/**
 * Edit and Delete for one expense; a deleted one goes to Trash, with Undo.
 * When a partner paid it, the menu also settles it between the partners.
 */
export function ExpenseRowMenu({ expense, dealOptions, defaults }: ExpenseRowMenuProps) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { settle, isPending: isSettling } = useSettleCost();
  const paidBy = expense.paidBy;

  function remove() {
    startTransition(async () => {
      const result = await deleteExpense(expense.id);
      showUndoToast(`Expense ${expense.description}`, result, restoreTrashItem);
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" size="icon-sm" variant="ghost" aria-label="Expense actions" disabled={isPending}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditing(true)}>Edit</DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={remove}>
            Delete
          </DropdownMenuItem>
          {isPartner(paidBy) && (
            <>
              <DropdownMenuSeparator />
              <SettlementRadioItems
                paidBy={paidBy}
                settlement={expense.settlement}
                disabled={isSettling}
                onSettle={(settlement) =>
                  settle(
                    { source: "expense", id: expense.id, label: expense.description, settlement: expense.settlement },
                    settlement
                  )
                }
              />
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {/* Outside the menu: a sheet mounted inside it would unmount the moment the menu closed. */}
      {editing && (
        <ExpenseSheet expense={expense} dealOptions={dealOptions} defaults={defaults} onClose={() => setEditing(false)} />
      )}
    </>
  );
}
