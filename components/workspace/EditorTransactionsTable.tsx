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
import { parseSheetDate } from "@/lib/editorTransactions";
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
    return [...transactions].sort((a, b) =>
      sort.column === "editor"
        ? direction * a.editor.localeCompare(b.editor, undefined, { sensitivity: "base" })
        : direction * (parseSheetDate(a.deliveryDate) - parseSheetDate(b.deliveryDate))
    );
  }, [transactions, sort]);

  const DeliveryDateSortIcon =
    sort.column !== "deliveryDate" ? ArrowUpDown : sort.direction === "asc" ? ArrowUp : ArrowDown;
  const EditorSortIcon = sort.column !== "editor" ? ArrowUpDown : sort.direction === "asc" ? ArrowUp : ArrowDown;

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableHead>Video</TableHead>
            <TableHead>Assigned date</TableHead>
            <TableHead>
              <button
                type="button"
                onClick={() => toggleSort("deliveryDate")}
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                Date delivered
                <DeliveryDateSortIcon className="size-3" />
              </button>
            </TableHead>
            <TableHead className="text-right">ETA</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>
              <button
                type="button"
                onClick={() => toggleSort("editor")}
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                Editor
                <EditorSortIcon className="size-3" />
              </button>
            </TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-8" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((txn) => (
            <EditEditorTransactionSheet key={txn.id} transaction={txn} editors={editors} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
