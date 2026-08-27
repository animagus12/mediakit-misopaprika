"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  buildInvoiceNumber,
  filterInvoices,
  findDuplicateInvoiceNumbers,
  formatInvoiceDate,
  formatInvoiceStatus,
  formatMoney,
  INVOICE_FILTER_TABS,
  invoiceStatusStyle,
  isInvoiceFilter,
  isInvoiceOverdue,
  sortInvoices,
  type InvoiceFilter,
  type InvoiceSortColumn,
  type SortDirection,
} from "@/lib/invoice";
import { cn } from "@/lib/utils";
import type { Invoice } from "@/repositories/invoices";
import { DeleteInvoiceButton } from "./DeleteInvoiceButton";

const PAGE_SIZE = 25;

type SortState = { column: InvoiceSortColumn; direction: SortDirection };

// Most recently issued first, until the creator picks another column.
const DEFAULT_SORT: SortState = { column: "issueDate", direction: "desc" };

interface InvoicesTableProps {
  invoices: Invoice[];
}

function SortHeader({
  column,
  label,
  className,
  sort,
  onToggle,
}: {
  column: InvoiceSortColumn;
  label: string;
  className?: string;
  sort: SortState;
  onToggle: (column: InvoiceSortColumn) => void;
}) {
  const Icon =
    sort.column !== column ? ArrowUpDown : sort.direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={() => onToggle(column)}
      className={cn("inline-flex items-center gap-1 hover:text-foreground", className)}
      aria-label={`Sort by ${label}`}
    >
      {label}
      <Icon className="size-3" />
    </button>
  );
}

export function InvoicesTable({ invoices }: InvoicesTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Tab and search live in the URL so the view is shareable and survives a
  // round-trip to the editor and back.
  const tabParam = searchParams.get("tab");
  const tab: InvoiceFilter = isInvoiceFilter(tabParam) ? tabParam : "all";
  const queryParam = searchParams.get("q") ?? "";

  const [query, setQuery] = useState(queryParam);
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const [page, setPage] = useState(1);

  // Adopt the URL value when it changes from the outside (a stat-card link,
  // browser back/forward) — the sanctioned "reset state on prop change" pattern.
  const [lastQueryParam, setLastQueryParam] = useState(queryParam);
  if (queryParam !== lastQueryParam) {
    setLastQueryParam(queryParam);
    setQuery(queryParam);
  }

  // Push local edits back to the URL, debounced so typing isn't one history
  // entry per keystroke.
  useEffect(() => {
    if (query === queryParam) return;
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (query.trim()) params.set("q", query);
      else params.delete("q");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, 250);
    return () => clearTimeout(timer);
  }, [query, queryParam, pathname, router, searchParams]);

  function setTab(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "all") params.delete("tab");
    else params.set("tab", next);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function toggleSort(column: InvoiceSortColumn) {
    setSort((current) =>
      current.column === column
        ? { column, direction: current.direction === "asc" ? "desc" : "asc" }
        : { column, direction: column === "status" ? "asc" : "desc" }
    );
  }

  const duplicateNumbers = useMemo(() => findDuplicateInvoiceNumbers(invoices), [invoices]);

  const filtered = useMemo(
    () => filterInvoices(invoices, { filter: tab, query }),
    [invoices, tab, query]
  );

  const sorted = useMemo(
    () => sortInvoices(filtered, sort.column, sort.direction),
    [filtered, sort]
  );

  // Snap back to page one whenever the filter, search, or sort changes.
  const resultSignature = `${tab} ${query} ${sort.column} ${sort.direction}`;
  const [lastSignature, setLastSignature] = useState(resultSignature);
  if (resultSignature !== lastSignature) {
    setLastSignature(resultSignature);
    setPage(1);
  }

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageRows = sorted.slice(pageStart, pageStart + PAGE_SIZE);

  const filtersActive = tab !== "all" || query.trim().length > 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            {INVOICE_FILTER_TABS.map((entry) => (
              <TabsTrigger key={entry.value} value={entry.value}>
                {entry.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search number, campaign, client, email..."
            className="pl-7"
          />
        </div>
      </div>

      {sorted.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-3 py-6 text-xs text-muted-foreground">
            No invoices match this view.
            {filtersActive && (
              <Button size="sm" variant="outline" onClick={() => { setQuery(""); setTab("all"); }}>
                Clear filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop: full table */}
          <div className="hidden overflow-x-auto rounded-md border border-border md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead>Number</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>
                    <SortHeader column="issueDate" label="Issued" sort={sort} onToggle={toggleSort} />
                  </TableHead>
                  <TableHead>
                    <SortHeader column="dueDate" label="Due" sort={sort} onToggle={toggleSort} />
                  </TableHead>
                  <TableHead className="text-right">
                    <SortHeader
                      column="subtotal"
                      label="Total"
                      className="ml-auto"
                      sort={sort}
                      onToggle={toggleSort}
                    />
                  </TableHead>
                  <TableHead className="text-right">
                    <SortHeader
                      column="balanceDue"
                      label="Balance"
                      className="ml-auto"
                      sort={sort}
                      onToggle={toggleSort}
                    />
                  </TableHead>
                  <TableHead>
                    <SortHeader column="status" label="Status" sort={sort} onToggle={toggleSort} />
                  </TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((invoice) => {
                  const status = invoiceStatusStyle(invoice.status);
                  const overdue = isInvoiceOverdue(invoice);
                  const duplicate = duplicateNumbers.has(invoice.invoiceNo.trim());
                  const label = buildInvoiceNumber(invoice.invoiceNo);
                  return (
                    <TableRow
                      key={invoice.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/invoices/${invoice.id}`)}
                    >
                      <TableCell className="font-medium">
                        <Link
                          href={`/invoices/${invoice.id}`}
                          onClick={(event) => event.stopPropagation()}
                          className="rounded-sm hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        >
                          {label}
                        </Link>
                        {duplicate && (
                          <span className="ml-1 text-[11px] font-normal text-amber-600 dark:text-amber-400">
                            · duplicate #
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <span
                          className="block max-w-40 truncate"
                          title={invoice.campaignName || undefined}
                        >
                          {invoice.campaignName || "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <span
                          className="block max-w-40 truncate text-foreground"
                          title={invoice.client.name || undefined}
                        >
                          {invoice.client.name || "—"}
                        </span>
                        {invoice.client.contactName && (
                          <span
                            className="block max-w-40 truncate text-xs"
                            title={invoice.client.contactName}
                          >
                            {invoice.client.contactName}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {formatInvoiceDate(invoice.issueDate) || "—"}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        <span className={overdue ? "text-destructive" : "text-muted-foreground"}>
                          {formatInvoiceDate(invoice.dueDate) || "—"}
                        </span>
                        {overdue && (
                          <span className="block text-[11px] text-destructive">Overdue</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(invoice.subtotal)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(invoice.balanceDue)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant} className={status.className}>
                          {formatInvoiceStatus(invoice.status)}
                        </Badge>
                      </TableCell>
                      <TableCell onClick={(event) => event.stopPropagation()}>
                        <DeleteInvoiceButton id={invoice.id} label={label} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile: stacked cards */}
          <ul className="space-y-2 md:hidden">
            {pageRows.map((invoice) => {
              const status = invoiceStatusStyle(invoice.status);
              const overdue = isInvoiceOverdue(invoice);
              const duplicate = duplicateNumbers.has(invoice.invoiceNo.trim());
              const label = buildInvoiceNumber(invoice.invoiceNo);
              return (
                <li key={invoice.id}>
                  <Card size="sm">
                    <CardContent className="space-y-2 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Link href={`/invoices/${invoice.id}`} className="font-medium hover:underline">
                            {label}
                          </Link>
                          {duplicate && (
                            <span className="ml-1 text-[11px] text-amber-600 dark:text-amber-400">
                              · duplicate #
                            </span>
                          )}
                          <p className="truncate text-muted-foreground">
                            {invoice.campaignName || "—"}
                          </p>
                        </div>
                        <Badge variant={status.variant} className={status.className}>
                          {formatInvoiceStatus(invoice.status)}
                        </Badge>
                      </div>
                      <p className="truncate">
                        <span className="text-foreground">{invoice.client.name || "—"}</span>
                        {invoice.client.contactName && (
                          <span className="text-muted-foreground"> · {invoice.client.contactName}</span>
                        )}
                      </p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 tabular-nums text-muted-foreground">
                        <span>Issued {formatInvoiceDate(invoice.issueDate) || "—"}</span>
                        <span className={overdue ? "text-destructive" : undefined}>
                          Due {formatInvoiceDate(invoice.dueDate) || "—"}
                          {overdue ? " · Overdue" : ""}
                        </span>
                        <span>
                          Total <span className="text-foreground">{formatMoney(invoice.subtotal)}</span>
                        </span>
                        <span>
                          Balance{" "}
                          <span className="text-foreground">{formatMoney(invoice.balanceDue)}</span>
                        </span>
                      </div>
                      <div className="flex justify-end">
                        <DeleteInvoiceButton id={invoice.id} label={label} />
                      </div>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {sorted.length <= PAGE_SIZE
                ? `${sorted.length} invoice${sorted.length === 1 ? "" : "s"}`
                : `Showing ${pageStart + 1}–${Math.min(pageStart + PAGE_SIZE, sorted.length)} of ${sorted.length}`}
            </span>
            {pageCount > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Previous
                </Button>
                <span className="px-1 tabular-nums">
                  Page {currentPage} / {pageCount}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= pageCount}
                  onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
