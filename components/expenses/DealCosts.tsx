"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { toSheetDate } from "@/lib/campaigns";
import { dealCashAfterCosts, dealName, lastExpenseDefaults } from "@/lib/expenses";
import { formatMoney } from "@/lib/invoice";
import { cn } from "@/lib/utils";
import type { Campaign } from "@/repositories/campaigns";
import { expenseCategoryLabel } from "@/repositories/expenses";
import { AddExpenseButton, ExpenseRowMenu } from "./ExpenseActions";

const ROW = "flex min-w-0 items-start gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs";

/**
 * What a deal cost to make and what it kept: its editing job, read from the
 * Editor workspace, and the expenses recorded against it, with the actions to
 * add, edit or delete one. Renders nothing when the deal was read without
 * its costs.
 */
export function DealCosts({ campaign }: { campaign: Campaign }) {
  const { costs } = campaign;
  if (!costs) return null;

  const dealOptions = [{ id: campaign.id, label: dealName(campaign) }];
  const defaults = { ...lastExpenseDefaults(costs.expenses), campaignId: campaign.id };
  const summary = dealCashAfterCosts(campaign);

  return (
    <div className="min-w-0 space-y-2">
      <p className="text-xs font-medium">Costs</p>
      {summary && summary.cash > 0 && (
        <p className="text-xs text-muted-foreground tabular-nums">
          {formatMoney(summary.costs)} spent ·{" "}
          <span className={cn("font-medium", summary.kept < 0 ? "text-destructive" : "text-foreground")}>
            {formatMoney(summary.kept)} kept
          </span>{" "}
          of {formatMoney(summary.cash)} cash
        </p>
      )}

      {!costs.editing && costs.expenses.length === 0 ? (
        <p className="text-xs text-muted-foreground">No costs recorded yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {costs.editing && (
            <li className={ROW}>
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex min-w-0 items-baseline justify-between gap-2">
                  <span className="truncate">Editing · {costs.editing.video || "Untitled video"}</span>
                  <span className="shrink-0 font-medium tabular-nums">
                    {costs.editing.amount > 0 ? formatMoney(costs.editing.amount) : "No amount set"}
                  </span>
                </div>
                <p className="truncate text-muted-foreground">
                  {costs.editing.editor || "Editor not named"} · {costs.editing.paid ? "Paid" : "Not paid yet"}
                </p>
                <Link href="/workspace" className="text-[11px] text-muted-foreground underline-offset-2 hover:underline">
                  Recorded in the Editor workspace
                </Link>
              </div>
            </li>
          )}
          {costs.expenses.map((expense) => (
            <li key={expense.id} className={ROW}>
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex min-w-0 items-baseline justify-between gap-2">
                  <span className="truncate">{expense.description}</span>
                  <span className="shrink-0 font-medium tabular-nums">{formatMoney(expense.amount)}</span>
                </div>
                <p className="truncate text-muted-foreground">
                  {toSheetDate(expense.date)} · {expenseCategoryLabel(expense.category)}
                </p>
                {expense.receiptUrl && (
                  <Badge variant="outline" className="text-[10px]">
                    Receipt
                  </Badge>
                )}
              </div>
              <ExpenseRowMenu expense={expense} dealOptions={dealOptions} defaults={defaults} />
            </li>
          ))}
        </ul>
      )}

      <AddExpenseButton dealOptions={dealOptions} defaults={defaults} />
    </div>
  );
}
