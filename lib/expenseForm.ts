// The expense form's state and its mapping to and from a stored expense.
// Pure and client-safe; kept out of the sheet component so the parsing is in
// one place and testable.

import { todayKey } from "@/lib/day";
import { parseFormAmount } from "@/lib/paymentForm";
import type { Payer, PaymentMethod } from "@/lib/payers";
import type { ExpenseCategory, ExpenseInput, ExpenseRecord } from "@/repositories/expenses";

export interface ExpenseFormState {
  /** yyyy-mm-dd, as <input type="date"> gives it. */
  date: string;
  /** As typed, so a half-typed "12." isn't rewritten under the cursor. */
  amount: string;
  category: ExpenseCategory;
  description: string;
  paidBy: Payer;
  method: PaymentMethod | null;
  campaignId: string | null;
  receiptUrl: string | null;
  note: string;
}

export interface ExpenseFormDefaults {
  paidBy: Payer;
  method: PaymentMethod | null;
  /** The deal a new expense starts on, when it is added from that deal. */
  campaignId?: string | null;
}

/** The form for an expense being edited, or a new one starting from `defaults` and today. */
export function expenseFormFrom(expense: ExpenseRecord | null, defaults: ExpenseFormDefaults): ExpenseFormState {
  if (expense) {
    return {
      date: expense.date,
      amount: String(expense.amount),
      category: expense.category,
      description: expense.description,
      // A row saved without a payer starts on the default, and saving asks for one anyway.
      paidBy: expense.paidBy ?? defaults.paidBy,
      method: expense.method,
      campaignId: expense.campaignId,
      receiptUrl: expense.receiptUrl,
      note: expense.note,
    };
  }
  return {
    date: todayKey(),
    amount: "",
    category: "props",
    description: "",
    paidBy: defaults.paidBy,
    method: defaults.method,
    campaignId: defaults.campaignId ?? null,
    receiptUrl: null,
    note: "",
  };
}

export function expenseInputFrom(form: ExpenseFormState, id: string): ExpenseInput {
  return {
    id,
    date: form.date,
    amount: parseFormAmount(form.amount),
    category: form.category,
    description: form.description.trim(),
    paidBy: form.paidBy,
    method: form.method,
    campaignId: form.campaignId,
    receiptUrl: form.receiptUrl,
    note: form.note.trim(),
  };
}
