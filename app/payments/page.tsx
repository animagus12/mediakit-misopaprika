import type { Metadata } from "next";
import Link from "next/link";
import AppShell from "@/components/common/AppShell";
import { FinancialYearFilter } from "@/components/common/FinancialYearFilter";
import { UnlinkedPayments } from "@/components/payments/UnlinkedPayments";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toSheetDate } from "@/lib/campaigns";
import { financialYearLabel, financialYearsPresent, resolveFinancialYearParam } from "@/lib/financialYear";
import { formatMoney } from "@/lib/invoice";
import { payerLabel } from "@/lib/payers";
import { sumLedgerRows, type LedgerRow } from "@/lib/payments";
import { getPaymentBook, type PaymentBook } from "@/repositories/paymentBook.server";

export const metadata: Metadata = {
  title: "Payments - @misopaprika",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

interface PaymentsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

// Where a payment is edited: on its deal (found by name in the campaigns
// table) or on its invoice.
function rowHref(row: LedgerRow): string {
  if (row.target.kind === "invoice") return `/invoices/${row.target.invoiceId}`;
  return `/campaigns?q=${encodeURIComponent(row.deal ?? "")}`;
}

function rowDate(row: LedgerRow): string {
  return row.date ? toSheetDate(row.date) : "Date not recorded";
}

function rowAccount(row: LedgerRow): string {
  return [row.receivedInto ? payerLabel(row.receivedInto) : "Account not recorded", row.method]
    .filter(Boolean)
    .join(" · ");
}

function EarlierRecordBadge() {
  return (
    <Badge variant="outline" className="text-[10px]">
      From earlier record
    </Badge>
  );
}

/** One payment as a card, below `md`, where the table would scroll sideways. */
function PaymentCard({ row }: { row: LedgerRow }) {
  const deductions = [`TDS ${formatMoney(row.tds)}`, `Charges ${formatMoney(row.fee)}`, `Net ${formatMoney(row.net)}`];
  return (
    <li className="min-w-0 space-y-0.5 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs">
      <div className="flex min-w-0 items-baseline justify-between gap-2">
        <span className="truncate font-medium">{row.brand}</span>
        <span className="shrink-0 font-medium tabular-nums">{formatMoney(row.gross)}</span>
      </div>
      <Link href={rowHref(row)} className="block truncate text-foreground/80 hover:underline">
        {row.targetLabel}
      </Link>
      <p className={row.date ? "text-muted-foreground" : "text-muted-foreground/70"}>{rowDate(row)}</p>
      {/* Wraps between figures, never inside one. */}
      <p className="text-muted-foreground tabular-nums">
        {deductions.map((part, index) => (
          <span key={part}>
            {index > 0 && " · "}
            <span className="whitespace-nowrap">{part}</span>
          </span>
        ))}
      </p>
      <p className="truncate text-muted-foreground" title={row.reference || undefined}>
        {rowAccount(row)}
        {row.reference ? ` · ${row.reference}` : ""}
      </p>
      {row.origin === "legacy" && <EarlierRecordBadge />}
    </li>
  );
}

function PaymentsTable({ rows }: { rows: LedgerRow[] }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Received</TableHead>
            <TableHead>Brand / for</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-right">TDS</TableHead>
            <TableHead className="text-right">Charges</TableHead>
            <TableHead className="text-right">Net</TableHead>
            <TableHead>Account</TableHead>
            <TableHead>Reference</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.paymentId}>
              <TableCell className="text-muted-foreground">{rowDate(row)}</TableCell>
              <TableCell className="max-w-64">
                <span className="block truncate font-medium">{row.brand}</span>
                <Link href={rowHref(row)} className="block truncate text-xs text-muted-foreground hover:underline">
                  {row.targetLabel}
                </Link>
                {row.origin === "legacy" && (
                  <span className="mt-1 block">
                    <EarlierRecordBadge />
                  </span>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatMoney(row.gross)}</TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">{formatMoney(row.tds)}</TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">{formatMoney(row.fee)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatMoney(row.net)}</TableCell>
              <TableCell className="text-muted-foreground">{rowAccount(row)}</TableCell>
              <TableCell className="max-w-40 truncate text-muted-foreground" title={row.reference || undefined}>
                {row.reference || "-"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default async function PaymentsPage({ searchParams }: PaymentsPageProps) {
  const params = await searchParams;
  let book: PaymentBook = { rows: [], orphans: [] };
  let error: string | null = null;
  try {
    book = await getPaymentBook();
  } catch (err) {
    error = err instanceof Error ? err.message : "Something went wrong";
  }

  // No ?fy= is the "All" view, as on the campaigns ledger.
  const years = financialYearsPresent(book.rows.map((row) => row.bucketDate).filter(Boolean));
  const selectedYear = resolveFinancialYearParam(params.fy, years);
  const rows = selectedYear === null ? book.rows : book.rows.filter((row) => row.fy === selectedYear);
  const undatedElsewhere = selectedYear === null ? 0 : book.rows.filter((row) => row.fy === null).length;
  const totals = sumLedgerRows(rows);
  const period = selectedYear === null ? "All years" : financialYearLabel(selectedYear);

  const stats = [
    { label: "Received", value: totals.gross, hint: "Before TDS and charges" },
    { label: "TDS withheld", value: totals.tds },
    { label: "Charges", value: totals.fee },
    { label: "Landed in accounts", value: totals.net, hint: "What actually arrived" },
  ];

  return (
    <AppShell>
      <div className="mx-auto max-w-screen-lg space-y-6 px-4 py-10 xl:max-w-6xl 2xl:max-w-[1440px]">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
          <p className="text-sm text-muted-foreground">
            Every payment brands made, filed by the day it arrived. Financial years run from April through March.
          </p>
        </div>

        {error && (
          <Card>
            <CardContent className="py-4 text-sm text-destructive">Payments couldn&apos;t be loaded: {error}</CardContent>
          </Card>
        )}

        <FinancialYearFilter pathname="/payments" searchParams={params} years={years} selected={selectedYear} includeAll />

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardHeader>
                <CardDescription>{stat.label}</CardDescription>
                <CardTitle className="tabular-nums">{formatMoney(stat.value)}</CardTitle>
                {stat.hint && <p className="text-xs text-muted-foreground">{stat.hint}</p>}
              </CardHeader>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {rows.length} payment{rows.length === 1 ? "" : "s"} · {period}
            </CardTitle>
            <CardDescription>
              Record, edit or delete a payment on its deal, renewal or invoice. Invoices marked Paid by hand before
              payments were recorded show here once a payment is recorded on them.
              {undatedElsewhere > 0 &&
                ` ${undatedElsewhere} payment${undatedElsewhere === 1 ? "" : "s"} from earlier records with no date ${undatedElsewhere === 1 ? "shows" : "show"} under All only.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {selectedYear === null ? "No payments recorded yet." : `Nothing received in ${period} yet.`}
              </p>
            ) : (
              <>
                <ul className="space-y-2 md:hidden">
                  {rows.map((row) => (
                    <PaymentCard key={row.paymentId} row={row} />
                  ))}
                </ul>
                <div className="hidden md:block">
                  <PaymentsTable rows={rows} />
                </div>
              </>
            )}
          </CardContent>
        </Card>

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
