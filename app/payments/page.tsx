import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import AppShell from "@/components/common/AppShell";
import { FinancialYearFilter } from "@/components/common/FinancialYearFilter";
import { AddExpenseButton } from "@/components/expenses/ExpenseActions";
import { PartnersCard } from "@/components/partners/PartnersCard";
import { CashFlowDetails, CashFlowStats } from "@/components/payments/CashFlowOverview";
import { MoneyList } from "@/components/payments/MoneyList";
import { UnlinkedPayments } from "@/components/payments/UnlinkedPayments";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { lastExpenseDefaults, summarizeOutflows } from "@/lib/expenses";
import { financialYearLabel, financialYearOfMonth, resolveFinancialYearParam } from "@/lib/financialYear";
import { sumMoney } from "@/lib/money";
import {
  entryFy,
  filterEntries,
  flowsByMonth,
  flowsByYear,
  moneyYears,
  parseMoneyFlow,
  sumFlows,
  type MoneyFlow,
} from "@/lib/moneyBook";
import { partnerCosts, summarizePartners } from "@/lib/partners";
import { getMoneyBook, type MoneyBook } from "@/repositories/paymentBook.server";

export const metadata: Metadata = {
  title: "Payments - @misopaprika",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

interface PaymentsPageProps {
  searchParams: Promise<SearchParams>;
}

const FLOWS: { flow: MoneyFlow | null; label: string }[] = [
  { flow: null, label: "All" },
  { flow: "in", label: "Money in" },
  { flow: "out", label: "Money out" },
];

const EMPTY_BOOK: MoneyBook = {
  entries: [],
  barterByMonth: new Map(),
  orphans: [],
  expenses: [],
  dealOptions: [],
  owedToYou: 0,
  owedToEditors: 0,
  settleUps: [],
};

// Links rather than client state, like the year filter beside it: the filter
// lives in ?flow=, so it survives a reload and a shared address. Every other
// param (the year) is kept.
function flowHref(params: SearchParams, flow: MoneyFlow | null): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "flow" || value === undefined) continue;
    for (const entry of Array.isArray(value) ? value : [value]) query.append(key, entry);
  }
  if (flow) query.set("flow", flow);
  const search = query.toString();
  return search ? `/payments?${search}` : "/payments";
}

function exportHref(fy: number | null, flow: MoneyFlow | null): string {
  const query = new URLSearchParams();
  if (fy !== null) query.set("fy", String(fy));
  if (flow) query.set("flow", flow);
  const search = query.toString();
  return search ? `/api/payments/export?${search}` : "/api/payments/export";
}

export default async function PaymentsPage({ searchParams }: PaymentsPageProps) {
  const params = await searchParams;
  const flow = parseMoneyFlow(params.flow);
  let book = EMPTY_BOOK;
  let error: string | null = null;
  try {
    book = await getMoneyBook();
  } catch (err) {
    error = err instanceof Error ? err.message : "Something went wrong";
  }

  // No ?fy= is every year, as on the campaigns ledger. The overview always
  // covers both directions for the year on show; the direction filter narrows
  // only the list (and the export).
  const years = moneyYears(book.entries);
  const fy = resolveFinancialYearParam(params.fy, years);
  const period = fy === null ? "All years" : financialYearLabel(fy);
  const inSpan = filterEntries(book.entries, { flow: null, fy });
  const shown = filterEntries(inSpan, { flow, fy: null });
  const barterByMonth =
    fy === null
      ? book.barterByMonth
      : new Map([...book.barterByMonth].filter(([month]) => financialYearOfMonth(month) === fy));
  const totals = sumFlows(inSpan, sumMoney([...barterByMonth.values()]));
  const outflows = inSpan.flatMap((entry) => (entry.kind === "outflow" ? [entry.row] : []));
  const spending = summarizeOutflows(outflows);
  // Balances between the partners run across every year: they don't reset in April.
  const partners = summarizePartners(
    partnerCosts(book.entries.flatMap((entry) => (entry.kind === "outflow" ? [entry.row] : []))),
    book.settleUps
  );
  const shownExpenseIds = new Set(
    shown.flatMap((entry) => (entry.kind === "outflow" && entry.row.source === "expense" ? [entry.row.id] : []))
  );
  // An old payment with no date at all belongs to no year: it is listed, and
  // counted, under All only.
  const undated = book.entries.filter((entry) => entryFy(entry) === null).length;
  const defaults = lastExpenseDefaults(book.expenses);
  const plural = shown.length === 1 ? "" : "s";
  const listTitle =
    flow === null ? `${shown.length} transaction${plural}` : `${shown.length} payment${plural} ${flow === "in" ? "in" : "out"}`;

  return (
    <AppShell>
      <div className="mx-auto max-w-screen-lg space-y-6 px-4 py-10 xl:max-w-6xl 2xl:max-w-[1440px]">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
          <p className="text-sm text-muted-foreground">
            Every rupee in and out, filed by the day it moved. Financial years run from April through March.
          </p>
        </div>

        {error && (
          <Card>
            <CardContent className="py-4 text-sm text-destructive">Payments couldn&apos;t be loaded: {error}</CardContent>
          </Card>
        )}

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <nav aria-label="Money in or out" className="flex flex-wrap gap-2">
            {FLOWS.map((option) => {
              const active = option.flow === flow;
              return (
                <Button key={option.label} asChild size="sm" variant={active ? "default" : "outline"}>
                  <Link href={flowHref(params, option.flow)} aria-current={active ? "page" : undefined}>
                    {option.label}
                  </Link>
                </Button>
              );
            })}
          </nav>
          <FinancialYearFilter pathname="/payments" searchParams={params} years={years} selected={fy} includeAll />
        </div>

        <CashFlowStats totals={totals} />

        <PartnersCard summary={partners} settleUps={book.settleUps} />

        <Card>
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1.5">
                <CardTitle className="text-base">
                  {listTitle} · {period}
                </CardTitle>
                <CardDescription>
                  Expenses are added and edited here. Brand payments are recorded on their deal or invoice, commission
                  on Affiliates and editor payments in the Editor workspace; each row links there.
                  {fy !== null &&
                    undated > 0 &&
                    ` ${undated} payment${undated === 1 ? "" : "s"} from earlier records with no date ${undated === 1 ? "shows" : "show"} under All only.`}
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <AddExpenseButton dealOptions={book.dealOptions} defaults={defaults} />
                <Button asChild size="sm" variant="outline">
                  <a href={exportHref(fy, flow)} download>
                    <Download />
                    Export CSV
                  </a>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {shown.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {fy === null ? "Nothing recorded yet." : `Nothing recorded in ${period} yet.`}
              </p>
            ) : (
              <MoneyList
                entries={shown}
                expenses={book.expenses.filter((expense) => shownExpenseIds.has(expense.id))}
                dealOptions={book.dealOptions}
                defaults={defaults}
              />
            )}
          </CardContent>
        </Card>

        <CashFlowDetails
          totals={totals}
          period={period}
          periods={fy === null ? flowsByYear(inSpan, barterByMonth) : flowsByMonth(inSpan, barterByMonth)}
          periodKind={fy === null ? "year" : "month"}
          payers={spending.byPayer}
          categories={spending.byCategory}
          owedToYou={book.owedToYou}
          owedToEditors={book.owedToEditors}
        />

        {book.orphans.length > 0 && (
          <Card id="unlinked" className="scroll-mt-20">
            <CardHeader>
              <CardTitle className="text-base">Payments with no deal</CardTitle>
              <CardDescription>
                What they were for no longer exists, so they count nowhere. Restore it from Trash if it is there, or
                delete them.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UnlinkedPayments payments={book.orphans} />
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
