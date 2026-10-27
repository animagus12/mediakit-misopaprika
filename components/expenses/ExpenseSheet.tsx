"use client";

import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { createExpense, updateExpense } from "@/app/expenses/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { todayKey } from "@/lib/day";
import { expenseFormFrom, expenseInputFrom, type ExpenseFormDefaults, type ExpenseFormState } from "@/lib/expenseForm";
import { validateExpense, type ExpenseDealOption } from "@/lib/expenses";
import { formatMoney } from "@/lib/invoice";
import { PAYER_OPTIONS, PAYMENT_METHOD_OPTIONS, type Payer, type PaymentMethod } from "@/lib/payers";
import {
  EXPENSE_CATEGORY_OPTIONS,
  EXPENSE_DESCRIPTION_MAX,
  EXPENSE_NOTE_MAX,
  type ExpenseCategory,
  type ExpenseRecord,
} from "@/repositories/expenses";
import { ReceiptUploadField } from "./ReceiptUploadField";

// Radix Select can't take "" as an item value.
const NO_METHOD = "__none__";
const NO_DEAL = "__none__";

interface ExpenseSheetProps {
  /** The expense being edited; absent records a new one. */
  expense?: ExpenseRecord;
  /** The deals it can be recorded against. */
  dealOptions: ExpenseDealOption[];
  defaults: ExpenseFormDefaults;
  /** Mounted open, once per opening, so a new expense always starts fresh with a new id. */
  onClose: () => void;
}

/**
 * Records a purchase the business made, or edits one: what it was, what it
 * cost, whose money paid for it and the deal it was for.
 *
 * Editor payments are not offered here: they are recorded in the Editor
 * workspace and already counted wherever money out is shown.
 */
export function ExpenseSheet({ expense, dealOptions, defaults, onClose }: ExpenseSheetProps) {
  const [form, setForm] = useState<ExpenseFormState>(() => expenseFormFrom(expense ?? null, defaults));
  // One id per opening: saving twice (a double tap, a retry) records one expense.
  const [expenseId] = useState(() => expense?.id ?? crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formId = `expense-${useId()}`;
  const id = (field: string) => `${formId}-${field}`;
  const editing = expense !== undefined;
  // A deal deleted since stays selectable as itself, so editing the expense doesn't silently unlink it.
  const linkedMissing = form.campaignId !== null && !dealOptions.some((option) => option.id === form.campaignId);

  function update<K extends keyof ExpenseFormState>(field: K, value: ExpenseFormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const input = expenseInputFrom(form, expenseId);
    const problem = validateExpense(input, todayKey());
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = editing ? await updateExpense(input) : await createExpense(input);
      if (!result.success) {
        setError(result.error);
        return;
      }
      onClose();
      toast.success(editing ? "Expense saved" : "Expense recorded", {
        description: `${formatMoney(input.amount)} on ${input.description}`,
      });
    });
  }

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader className="min-w-0">
          <SheetTitle>{editing ? "Edit expense" : "Add expense"}</SheetTitle>
          <SheetDescription>
            Something the business paid for. Editor payments are recorded in the Editor workspace and count here on
            their own.
          </SheetDescription>
        </SheetHeader>

        <form id={formId} onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto px-6 pb-4">
          <div className="space-y-2">
            <Label htmlFor={id("description")}>What was it</Label>
            <Input
              id={id("description")}
              maxLength={EXPENSE_DESCRIPTION_MAX}
              placeholder="e.g. Spider-Man figure for the shoot"
              value={form.description}
              onChange={(event) => update("description", event.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <Label htmlFor={id("amount")}>Amount (₹)</Label>
              <Input
                id={id("amount")}
                inputMode="decimal"
                className="tabular-nums"
                value={form.amount}
                onChange={(event) => update("amount", event.target.value)}
              />
            </div>
            <div className="min-w-0 space-y-2">
              <Label htmlFor={id("date")}>Date paid</Label>
              <Input
                id={id("date")}
                type="date"
                max={todayKey()}
                value={form.date}
                onChange={(event) => update("date", event.target.value)}
              />
            </div>
            <div className="min-w-0 space-y-2">
              <Label htmlFor={id("category")}>Category</Label>
              <Select value={form.category} onValueChange={(value) => update("category", value as ExpenseCategory)}>
                <SelectTrigger id={id("category")} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0 space-y-2">
              <Label htmlFor={id("paidBy")}>Paid by</Label>
              <Select value={form.paidBy} onValueChange={(value) => update("paidBy", value as Payer)}>
                <SelectTrigger id={id("paidBy")} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={id("method")}>Method</Label>
            <Select
              value={form.method ?? NO_METHOD}
              onValueChange={(value) => update("method", value === NO_METHOD ? null : (value as PaymentMethod))}
            >
              <SelectTrigger id={id("method")} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_METHOD}>Not recorded</SelectItem>
                {PAYMENT_METHOD_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor={id("deal")}>For a deal</Label>
            <Select
              value={form.campaignId ?? NO_DEAL}
              onValueChange={(value) => update("campaignId", value === NO_DEAL ? null : value)}
            >
              <SelectTrigger id={id("deal")} className="w-full min-w-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_DEAL}>No deal: a general expense</SelectItem>
                {linkedMissing && form.campaignId && <SelectItem value={form.campaignId}>A deleted deal</SelectItem>}
                {dealOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    <span className="truncate">{option.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Linked to a deal, it shows in that deal&apos;s costs and comes off what the deal kept.
            </p>
          </div>

          <ReceiptUploadField
            id={id("receipt")}
            value={form.receiptUrl}
            onChange={(url) => update("receiptUrl", url)}
            onError={(message) => toast.error(message)}
          />

          <div className="space-y-2">
            <Label htmlFor={id("note")}>Note</Label>
            <Textarea
              id={id("note")}
              rows={2}
              maxLength={EXPENSE_NOTE_MAX}
              placeholder="Shop, order number, anything worth keeping"
              value={form.note}
              onChange={(event) => update("note", event.target.value)}
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </form>

        <SheetFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <SheetClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </SheetClose>
          <Button type="submit" form={formId} disabled={isPending}>
            {isPending ? "Saving…" : editing ? "Save expense" : "Add expense"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
