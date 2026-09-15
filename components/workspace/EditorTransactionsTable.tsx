"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { parseSheetDate } from "@/lib/editorTransactions";
import { cn } from "@/lib/utils";
import { EditEditorTransactionSheet } from "./EditEditorTransactionSheet";
import type { EditorTransaction } from "@/repositories/editorTransactions";
import type { Editor } from "@/repositories/editors";

type SortColumn = "deliveryDate" | "editor";
type SortDirection = "asc" | "desc";

interface SortState {
  column: SortColumn;
  direction: SortDirection;
}

// Most recently delivered work first, until the creator picks a different column.
const DEFAULT_SORT: SortState = { column: "deliveryDate", direction: "desc" };

interface EditorTransactionsTableProps {
  transactions: EditorTransaction[];
  editors: Editor[];
}

export function EditorTransactionsTable({ transactions, editors }: EditorTransactionsTableProps) {
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);

  function toggleSort(column: SortColumn) {
    setSort((current) =>
      current.column === column
        ? { column, direction: current.direction === "asc" ? "desc" : "asc" }
        : { column, direction: column === "deliveryDate" ? "desc" : "asc" }
    );
  }

  const sorted = useMemo(() => {
    const direction = sort.direction === "asc" ? 1 : -1;
    return [...transactions].sort((a, b) => {
      if (sort.column === "editor") {
        return direction * a.editor.localeCompare(b.editor, undefined, { sensitivity: "base" });
      }
      // Undelivered cuts are the work still in progress, so they stay on top
      // whichever way the column is sorted, newest assigned first.
      const aDelivered = parseSheetDate(a.deliveryDate);
      const bDelivered = parseSheetDate(b.deliveryDate);
      const aPending = Number.isNaN(aDelivered);
      const bPending = Number.isNaN(bDelivered);
      if (aPending !== bPending) return aPending ? -1 : 1;
      if (aPending) return (parseSheetDate(b.videoDate) || 0) - (parseSheetDate(a.videoDate) || 0);
      return direction * (aDelivered - bDelivered);
    });
  }, [transactions, sort]);

  return (
    <Card size="sm" className="py-0">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableHead className="h-9">Video</TableHead>
            <TableHead className="hidden h-9 md:table-cell">Assigned</TableHead>
            <SortableHead column="deliveryDate" sort={sort} onSort={toggleSort}>
              Delivered
            </SortableHead>
            <TableHead className="hidden h-9 text-right md:table-cell">ETA</TableHead>
            <TableHead className="h-9 text-right">Revisions</TableHead>
            <TableHead className="h-9 text-right">Amount</TableHead>
            <SortableHead column="editor" sort={sort} onSort={toggleSort}>
              Editor
            </SortableHead>
            <TableHead className="h-9">Status</TableHead>
            <TableHead className="h-9 w-8">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((txn) => (
            <EditEditorTransactionSheet key={txn.id} transaction={txn} editors={editors} />
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

interface SortableHeadProps {
  column: SortColumn;
  sort: SortState;
  onSort: (column: SortColumn) => void;
  children: React.ReactNode;
}

// aria-sort goes on the header cell, not the button, so a screen reader
// announces the order when moving through the column as well as on the click.
function SortableHead({ column, sort, onSort, children }: SortableHeadProps) {
  const active = sort.column === column;
  const Icon = !active ? ArrowUpDown : sort.direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead
      className="h-9"
      aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className="-mx-1 inline-flex items-center gap-1 rounded-sm px-1 py-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        {children}
        <Icon className={cn("size-3", active ? "text-foreground" : "text-muted-foreground")} />
      </button>
    </TableHead>
  );
}
