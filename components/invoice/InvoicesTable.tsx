"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
  formatInvoiceDate,
  formatInvoiceStatus,
  formatMoney,
  invoiceStatusStyle,
  isInvoiceOverdue,
} from "@/lib/invoice";
import type { Invoice } from "@/repositories/invoices";
import { DeleteInvoiceButton } from "./DeleteInvoiceButton";

type FilterTab = "all" | "draft" | "sent" | "paid" | "overdue";

const FILTER_TABS: { value: FilterTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
];

interface InvoicesTableProps {
  invoices: Invoice[];
}

export function InvoicesTable({ invoices }: InvoicesTableProps) {
  const router = useRouter();
  const [tab, setTab] = useState<FilterTab>("all");
  const [query, setQuery] = useState("");

  // Same invoice number typed on two records — flag every copy so a clash is
  // visible from the list without opening each one.
  const duplicateNumbers = useMemo(() => {
    const counts = new Map<string, number>();
    for (const invoice of invoices) {
      const key = invoice.invoiceNo.trim();
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return new Set([...counts].filter(([, count]) => count > 1).map(([key]) => key));
  }, [invoices]);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return invoices
      .filter((invoice) => {
        if (tab === "overdue") return isInvoiceOverdue(invoice);
        if (tab !== "all") return invoice.status === tab;
        return true;
      })
      .filter((invoice) => {
        if (!needle) return true;
        return (
          buildInvoiceNumber(invoice.invoiceNo).toLowerCase().includes(needle) ||
          invoice.campaignName.toLowerCase().includes(needle) ||
          invoice.client.name.toLowerCase().includes(needle) ||
          invoice.client.contactName.toLowerCase().includes(needle) ||
          invoice.client.email.toLowerCase().includes(needle)
        );
      })
      .slice()
      .sort(
        (a, b) =>
          b.issueDate.localeCompare(a.issueDate) || b.createdAt.localeCompare(a.createdAt)
      );
  }, [invoices, tab, query]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={tab} onValueChange={(value) => setTab(value as FilterTab)}>
          <TabsList>
            {FILTER_TABS.map((entry) => (
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

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-xs text-muted-foreground">
            No invoices match this view.
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead>Number</TableHead>
                <TableHead>Campaign</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>Due</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((invoice) => {
                const status = invoiceStatusStyle(invoice.status);
                const overdue = isInvoiceOverdue(invoice);
                const duplicate = duplicateNumbers.has(invoice.invoiceNo.trim());
                return (
                  <TableRow
                    key={invoice.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/invoices/${invoice.id}`)}
                  >
                    <TableCell className="font-medium">
                      {buildInvoiceNumber(invoice.invoiceNo)}
                      {duplicate && (
                        <span className="ml-1 text-[11px] font-normal text-amber-600 dark:text-amber-400">
                          · duplicate #
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <span className="block max-w-40 truncate">{invoice.campaignName || "—"}</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <span className="block max-w-40 truncate text-foreground">
                        {invoice.client.name || "—"}
                      </span>
                      {invoice.client.contactName && (
                        <span className="block max-w-40 truncate text-xs">
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
                      {overdue && <span className="block text-[11px] text-destructive">Overdue</span>}
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
                      <DeleteInvoiceButton
                        id={invoice.id}
                        label={buildInvoiceNumber(invoice.invoiceNo)}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
