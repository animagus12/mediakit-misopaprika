import Link from "next/link";
import { FinancialYearFilter } from "@/components/common/FinancialYearFilter";
import { AddExpenseButton } from "@/components/expenses/ExpenseActions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { lastExpenseDefaults, outflowCategoryLabel, summarizeOutflows } from "@/lib/expenses";
import { financialYearLabel, financialYearsPresent, resolveFinancialYearParam } from "@/lib/financialYear";
import { formatMoney } from "@/lib/invoice";
import { payerLabel } from "@/lib/payers";
import { getMoneyOut, type MoneyOut } from "@/repositories/paymentBook.server";
import { MoneyOutList } from "./MoneyOutList";

interface MoneyOutViewProps {
  searchParams: Record<string, string | string[] | undefined>;
}

/**
 * Everything that went out, by financial year: what was spent, on what, and
 * out of whose account. Editor payments come from the Editor workspace as
 * they are recorded there; expenses are added and edited here.
 */
export async function MoneyOutView({ searchParams }: MoneyOutViewProps) {
  let data: MoneyOut = { rows: [], expenses: [], dealOptions: [], owedToEditors: 0 };
  let error: string | null = null;
  try {
    data = await getMoneyOut();
  } catch (err) {
    error = err instanceof Error ? err.message : "Something went wrong";
  }

  // No ?fy= is the "All" view, as on money in.
  const years = financialYearsPresent(data.rows.map((row) => row.date));
  const selectedYear = resolveFinancialYearParam(searchParams.fy, years);
  const rows = selectedYear === null ? data.rows : data.rows.filter((row) => row.fy === selectedYear);
  const shown = new Set(rows.map((row) => row.id));
  const totals = summarizeOutflows(rows);
  const period = selectedYear === null ? "All years" : financialYearLabel(selectedYear);
  const defaults = lastExpenseDefaults(data.expenses);

  const stats = [
    { label: "Spent", value: totals.total, hint: "Editing and expenses" },
    { label: "Editing", value: totals.editing, hint: "Paid to editors" },
    { label: "Expenses", value: totals.expenses, hint: "Everything else" },
    { label: "Owed to editors", value: data.owedToEditors, hint: "Done, not paid yet" },
  ];

  return (
    <>
      {error && (
        <Card>
          <CardContent className="py-4 text-sm text-destructive">Money out couldn&apos;t be loaded: {error}</CardContent>
        </Card>
      )}

      <FinancialYearFilter pathname="/payments" searchParams={searchParams} years={years} selected={selectedYear} includeAll />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader>
              <CardDescription>{stat.label}</CardDescription>
              <CardTitle className="tabular-nums">{formatMoney(stat.value)}</CardTitle>
              <p className="text-xs text-muted-foreground">{stat.hint}</p>
            </CardHeader>
          </Card>
        ))}
      </div>

      {totals.total > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Where it went · {period}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">By category</p>
              <ul className="space-y-1 text-sm">
                {totals.byCategory.map((entry) => (
                  <li key={entry.category} className="flex min-w-0 justify-between gap-3">
                    <span className="truncate">{outflowCategoryLabel(entry.category)}</span>
                    <span className="shrink-0 tabular-nums">{formatMoney(entry.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="min-w-0 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Paid by</p>
              <ul className="space-y-1 text-sm">
                {totals.byPayer.map((entry) => (
                  <li key={entry.payer ?? "none"} className="flex min-w-0 justify-between gap-3">
                    <span className="truncate">{entry.payer ? payerLabel(entry.payer) : "Not recorded"}</span>
                    <span className="shrink-0 tabular-nums">{formatMoney(entry.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1.5">
              <CardTitle className="text-base">
                {rows.length} payment{rows.length === 1 ? "" : "s"} out · {period}
              </CardTitle>
              <CardDescription>
                Expenses are added and edited here. Editor payments come from the{" "}
                <Link href="/workspace" className="underline underline-offset-2">
                  Editor workspace
                </Link>{" "}
                as soon as a job is marked Paid there.
                {totals.estimated > 0 &&
                  ` ${formatMoney(totals.estimated)} of editing was paid before paid dates were recorded, so it is filed by the day the video was delivered.`}
              </CardDescription>
            </div>
            <AddExpenseButton dealOptions={data.dealOptions} defaults={defaults} />
          </div>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {selectedYear === null ? "Nothing spent yet." : `Nothing spent in ${period} yet.`}
            </p>
          ) : (
            <MoneyOutList
              rows={rows}
              expenses={data.expenses.filter((expense) => shown.has(expense.id))}
              dealOptions={data.dealOptions}
              defaults={defaults}
            />
          )}
        </CardContent>
      </Card>
    </>
  );
}
