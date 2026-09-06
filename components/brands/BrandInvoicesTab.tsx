import Link from "next/link";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  buildInvoiceNumber,
  computeInvoiceMargin,
  formatInvoiceDate,
  formatInvoiceStatus,
  formatMoney,
  invoiceStatusStyle,
  isInvoiceOverdue,
  type InvoiceEditorJobOption,
} from "@/lib/invoice";
import type { Invoice } from "@/repositories/invoices";

interface BrandInvoicesTabProps {
  brandId: string;
  invoices: Invoice[]; // already scoped to this brand, see lib/invoice.ts's invoicesForBrand
  editorJobs: InvoiceEditorJobOption[];
}

export function BrandInvoicesTab({ brandId, invoices, editorJobs }: BrandInvoicesTabProps) {
  const newHref = `/invoices/new?brandId=${brandId}`;

  if (invoices.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-start gap-3 py-6 text-xs text-muted-foreground">
          No invoices for this brand yet.
          <Button asChild size="sm">
            <Link href={newHref}>
              <Plus className="size-3.5" />
              New invoice
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Most recently issued first: mirrors the /invoices list default sort.
  const rows = [...invoices].sort((a, b) => b.issueDate.localeCompare(a.issueDate));
  const anyMargin = rows.some((invoice) => computeInvoiceMargin(invoice, editorJobs) !== null);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {rows.length} invoice{rows.length === 1 ? "" : "s"}
        </span>
        <Button asChild size="sm" variant="outline">
          <Link href={newHref}>
            <Plus className="size-3.5" />
            New invoice
          </Link>
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead>Number</TableHead>
              <TableHead>Campaign</TableHead>
              <TableHead>Due</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              {anyMargin && <TableHead className="text-right">Margin</TableHead>}
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((invoice) => {
              const status = invoiceStatusStyle(invoice.status);
              const overdue = isInvoiceOverdue(invoice);
              const margin = computeInvoiceMargin(invoice, editorJobs);
              return (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">
                    <Link href={`/invoices/${invoice.id}`} className="hover:underline">
                      {buildInvoiceNumber(invoice.invoiceNo)}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-40 truncate text-muted-foreground">
                    {invoice.campaignName || "-"}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    <span className={overdue ? "text-destructive" : "text-muted-foreground"}>
                      {formatInvoiceDate(invoice.dueDate) || "-"}
                    </span>
                    {overdue && <span className="block text-[11px] text-destructive">Overdue</span>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(invoice.subtotal)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(invoice.balanceDue)}</TableCell>
                  {anyMargin && (
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {margin ? formatMoney(margin.margin) : "-"}
                    </TableCell>
                  )}
                  <TableCell>
                    <Badge variant={status.variant} className={status.className}>
                      {formatInvoiceStatus(invoice.status)}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
