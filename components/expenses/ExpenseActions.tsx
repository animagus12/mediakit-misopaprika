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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

/** Edit and Delete for one expense; a deleted one goes to Trash, with Undo. */
export function ExpenseRowMenu({ expense, dealOptions, defaults }: ExpenseRowMenuProps) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

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
        </DropdownMenuContent>
      </DropdownMenu>
      {/* Outside the menu: a sheet mounted inside it would unmount the moment the menu closed. */}
      {editing && (
        <ExpenseSheet expense={expense} dealOptions={dealOptions} defaults={defaults} onClose={() => setEditing(false)} />
      )}
    </>
  );
}
