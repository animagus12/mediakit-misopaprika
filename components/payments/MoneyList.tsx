"use client";

import Link from "next/link";
import { ExpenseRowMenu } from "@/components/expenses/ExpenseActions";
import { CostSettlementMenu } from "@/components/partners/CostSettlementMenu";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toSheetDate } from "@/lib/campaigns";
import type { ExpenseFormDefaults } from "@/lib/expenseForm";
import type { ExpenseDealOption } from "@/lib/expenses";
import { formatMoney } from "@/lib/invoice";
import {
  entryAmount,
  entryCategory,
  entryDate,
  entryDetail,
  entryFlags,
  entryHref,
  entryKey,
  entryMethod,
  entryPaidBy,
  entryTitle,
  type MoneyEntry,
} from "@/lib/moneyBook";
import { isPartner, partnerSettlementLabel, payerLabel } from "@/lib/payers";
import { cn } from "@/lib/utils";
import type { ExpenseRecord } from "@/repositories/expenses";

// Money in reads green, the semantic colour convention's raw palette at the
// app's usual weight; money out stays in the text colour, so the list reads as
// a statement rather than as a list of alarms.
const IN_TONE = "text-emerald-600 dark:text-emerald-400";

function signedAmount(entry: MoneyEntry): string {
  return `${entry.flow === "in" ? "+" : "−"} ${formatMoney(entryAmount(entry))}`;
}

function dateText(entry: MoneyEntry): string {
  const date = entryDate(entry);
  return date ? toSheetDate(date) : "Date not recorded";
}

// Money in always lands in the business account, so it says only how it
// came; a cost says who paid it.
function accountText(entry: MoneyEntry): string {
  if (entry.flow === "in") return entryMethod(entry) ?? "Method not recorded";
  const paidBy = entryPaidBy(entry);
  return [paidBy ? `Paid by ${payerLabel(paidBy)}` : "Payer not recorded", entryMethod(entry)].filter(Boolean).join(" · ");
}

/** TDS, charges and what landed, for a payment that had anything taken from it. */
function Deductions({ entry }: { entry: MoneyEntry }) {
  if (entry.kind !== "payment" || (entry.row.tds === 0 && entry.row.fee === 0)) return null;
  const parts = [`TDS ${formatMoney(entry.row.tds)}`, `Charges ${formatMoney(entry.row.fee)}`, `Net ${formatMoney(entry.row.net)}`];
  return (
    <p className="text-muted-foreground tabular-nums">
      {parts.map((part, index) => (
        <span key={part}>
          {index > 0 && " · "}
          <span className="whitespace-nowrap">{part}</span>
        </span>
      ))}
    </p>
  );
}

function Badges({ entry }: { entry: MoneyEntry }) {
  const flags = entryFlags(entry);
  const receipt = entry.kind === "outflow" ? entry.row.receiptUrl : null;
  // A cost a partner paid says how it is being settled; undecided reads amber.
  const settlement = entry.kind === "outflow" && isPartner(entry.row.paidBy) ? entry.row.settlement : undefined;
  if (flags.length === 0 && !receipt && settlement === undefined) return null;
  return (
    <span className="mt-1 flex flex-wrap gap-1">
      {settlement !== undefined && (
        <Badge
          variant="outline"
          className={cn(
            "text-[10px]",
            settlement === null &&
              "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
          )}
        >
          {partnerSettlementLabel(settlement)}
        </Badge>
      )}
      {flags.map((flag) => (
        <Badge key={flag} variant="outline" className="text-[10px]">
          {flag}
        </Badge>
      ))}
      {receipt && (
        <Badge asChild variant="outline" className="text-[10px]">
          <a href={receipt} target="_blank" rel="noreferrer">
            Receipt
          </a>
        </Badge>
      )}
    </span>
  );
}

/** What it was for, linked to where it is changed when that is elsewhere. */
function Detail({ entry, className }: { entry: MoneyEntry; className?: string }) {
  const detail = entryDetail(entry);
  const href = entryHref(entry);
  const label = [detail, entryCategory(entry)].filter(Boolean).join(" · ");
  if (!href) return <span className={className}>{label}</span>;
  return (
    <Link href={href} className={cn("underline-offset-2 hover:underline", className)}>
      {label}
    </Link>
  );
}

interface MoneyListProps {
  entries: MoneyEntry[];
  /** The expenses among `entries`, for editing one where it is listed. */
  expenses: ExpenseRecord[];
  dealOptions: ExpenseDealOption[];
  defaults: ExpenseFormDefaults;
}

/**
 * Every transaction in and out, newest first: cards on a phone, a table from
 * `md` up. An expense is edited or deleted here; everything else links to
 * where it is recorded, so nothing is edited in two places.
 */
export function MoneyList({ entries, expenses, dealOptions, defaults }: MoneyListProps) {
  const expenseById = new Map(expenses.map((expense) => [expense.id, expense]));

  function menu(entry: MoneyEntry) {
    if (entry.kind !== "outflow") return null;
    const expense = entry.row.source === "expense" ? expenseById.get(entry.row.id) : undefined;
    if (expense) return <ExpenseRowMenu expense={expense} dealOptions={dealOptions} defaults={defaults} />;
    // An editor payment is edited in the workspace; only how a partner's
    // payment is settled is decided here.
    if (entry.row.source === "editing" && isPartner(entry.row.paidBy)) {
      return (
        <CostSettlementMenu
          cost={{ source: "editing", id: entry.row.id, label: entry.row.description || "Editing", settlement: entry.row.settlement }}
          paidBy={entry.row.paidBy}
        />
      );
    }
    return null;
  }

  return (
    <>
      <ul className="space-y-2 md:hidden">
        {entries.map((entry) => (
          <li
            key={entryKey(entry)}
            className="flex min-w-0 items-start gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs"
          >
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="flex min-w-0 items-baseline justify-between gap-2">
                <span className="truncate font-medium">{entryTitle(entry)}</span>
                <span className={cn("shrink-0 font-medium tabular-nums", entry.flow === "in" && IN_TONE)}>
                  {signedAmount(entry)}
                </span>
              </div>
              <Detail entry={entry} className="block truncate text-foreground/80" />
              <p className="truncate text-muted-foreground">
                {dateText(entry)} · {accountText(entry)}
              </p>
              <Deductions entry={entry} />
              <Badges entry={entry} />
            </div>
            {menu(entry)}
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">In</TableHead>
              <TableHead className="text-right">Out</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={entryKey(entry)}>
                <TableCell className="text-muted-foreground">{dateText(entry)}</TableCell>
                <TableCell className="max-w-80 text-xs">
                  <span className="block truncate text-sm font-medium">{entryTitle(entry)}</span>
                  <Detail entry={entry} className="block truncate text-muted-foreground" />
                  <Deductions entry={entry} />
                  <Badges entry={entry} />
                </TableCell>
                <TableCell className={cn("text-right tabular-nums", IN_TONE)}>
                  {entry.flow === "in" ? formatMoney(entryAmount(entry)) : ""}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {entry.flow === "out" ? formatMoney(entryAmount(entry)) : ""}
                </TableCell>
                <TableCell className="text-muted-foreground">{accountText(entry)}</TableCell>
                <TableCell className="text-right">{menu(entry)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
