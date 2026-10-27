"use client";

import Link from "next/link";
import { ExpenseRowMenu } from "@/components/expenses/ExpenseActions";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toSheetDate } from "@/lib/campaigns";
import type { ExpenseFormDefaults } from "@/lib/expenseForm";
import { outflowCategoryLabel, type ExpenseDealOption, type OutflowRow } from "@/lib/expenses";
import { formatMoney } from "@/lib/invoice";
import { payerLabel } from "@/lib/payers";
import type { ExpenseRecord } from "@/repositories/expenses";

function rowDate(row: OutflowRow): string {
  return toSheetDate(row.date);
}

function rowPaidBy(row: OutflowRow): string {
  return [row.paidBy ? payerLabel(row.paidBy) : "Payer not recorded", row.method].filter(Boolean).join(" · ");
}

/** What the row was for: the deal, the editor, or nothing. */
function rowContext(row: OutflowRow): string {
  return [outflowCategoryLabel(row.category), row.editor, row.dealLabel].filter(Boolean).join(" · ");
}

interface MoneyOutListProps {
  rows: OutflowRow[];
  /** The expenses among `rows`, for editing one in place. */
  expenses: ExpenseRecord[];
  dealOptions: ExpenseDealOption[];
  defaults: ExpenseFormDefaults;
}

/**
 * Every sum that went out: expenses, edited or deleted here, and editor
 * payments, which are only listed: they are changed in the Editor workspace,
 * where they are recorded.
 */
export function MoneyOutList({ rows, expenses, dealOptions, defaults }: MoneyOutListProps) {
  const expenseById = new Map(expenses.map((expense) => [expense.id, expense]));

  function actions(row: OutflowRow) {
    const expense = row.source === "expense" ? expenseById.get(row.id) : undefined;
    if (expense) return <ExpenseRowMenu expense={expense} dealOptions={dealOptions} defaults={defaults} />;
    return (
      <Link href="/workspace" className="text-[11px] whitespace-nowrap text-muted-foreground underline-offset-2 hover:underline">
        Workspace
      </Link>
    );
  }

  function badges(row: OutflowRow) {
    return (
      <>
        {row.source === "editing" && (
          <Badge variant="outline" className="text-[10px]">
            From Editor workspace
          </Badge>
        )}
        {row.estimated && (
          <Badge variant="outline" className="text-[10px]" title="Paid before paid dates were recorded: filed by the delivery date">
            Date estimated
          </Badge>
        )}
        {row.receiptUrl && (
          <Badge asChild variant="outline" className="text-[10px]">
            <a href={row.receiptUrl} target="_blank" rel="noreferrer">
              Receipt
            </a>
          </Badge>
        )}
      </>
    );
  }

  return (
    <>
      <ul className="space-y-2 md:hidden">
        {rows.map((row) => (
          <li
            key={`${row.source}-${row.id}`}
            className="flex min-w-0 items-start gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs"
          >
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="flex min-w-0 items-baseline justify-between gap-2">
                <span className="truncate font-medium">{row.description || "Untitled"}</span>
                <span className="shrink-0 font-medium tabular-nums">{formatMoney(row.amount)}</span>
              </div>
              <p className="truncate text-foreground/80">{rowContext(row)}</p>
              <p className="truncate text-muted-foreground">
                {rowDate(row)} · {rowPaidBy(row)}
              </p>
              <div className="flex flex-wrap gap-1 empty:hidden">{badges(row)}</div>
            </div>
            {actions(row)}
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Paid</TableHead>
              <TableHead>What</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Paid by</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={`${row.source}-${row.id}`}>
                <TableCell className="text-muted-foreground">{rowDate(row)}</TableCell>
                <TableCell className="max-w-72">
                  <span className="block truncate font-medium">{row.description || "Untitled"}</span>
                  {(row.editor || row.dealLabel) && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {[row.editor, row.dealLabel].filter(Boolean).join(" · ")}
                    </span>
                  )}
                  <span className="mt-1 flex flex-wrap gap-1 empty:hidden">{badges(row)}</span>
                </TableCell>
                <TableCell className="text-muted-foreground">{outflowCategoryLabel(row.category)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(row.amount)}</TableCell>
                <TableCell className="text-muted-foreground">{rowPaidBy(row)}</TableCell>
                <TableCell className="text-right">{actions(row)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
