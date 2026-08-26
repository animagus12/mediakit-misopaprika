"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { brandStatusStyle, type BrandRow } from "@/lib/brands";
import { formatMoney } from "@/lib/invoice";

type SortColumn = "name" | "revenue" | "lastCollabDate";
type SortDirection = "asc" | "desc";

interface SortState {
  column: SortColumn;
  direction: SortDirection;
}

const DEFAULT_SORT: SortState = { column: "name", direction: "asc" };

// Sheet dates are DD/MM/YYYY; unparsable/blank dates sort last.
function parseSheetDate(date: string | null): number {
  const match = date?.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return Number.NEGATIVE_INFINITY;
  const [, day, month, year] = match;
  return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
}

interface BrandsTableProps {
  rows: BrandRow[];
}

export function BrandsTable({ rows }: BrandsTableProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);

  function toggleSort(column: SortColumn) {
    setSort((current) =>
      current.column === column
        ? { column, direction: current.direction === "asc" ? "desc" : "asc" }
        : { column, direction: column === "name" ? "asc" : "desc" }
    );
  }

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? rows.filter((row) => row.searchText.includes(needle)) : rows;
  }, [rows, query]);

  const sorted = useMemo(() => {
    const direction = sort.direction === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sort.column === "name") return direction * a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      if (sort.column === "revenue") return direction * (a.revenue - b.revenue);
      return direction * (parseSheetDate(a.lastCollabDate) - parseSheetDate(b.lastCollabDate));
    });
  }, [filtered, sort]);

  const NameSortIcon = sort.column !== "name" ? ArrowUpDown : sort.direction === "asc" ? ArrowUp : ArrowDown;
  const RevenueSortIcon = sort.column !== "revenue" ? ArrowUpDown : sort.direction === "asc" ? ArrowUp : ArrowDown;
  const LastCollabSortIcon =
    sort.column !== "lastCollabDate" ? ArrowUpDown : sort.direction === "asc" ? ArrowUp : ArrowDown;

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search brands, agencies, contacts..."
          className="pl-7"
        />
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-xs text-muted-foreground">
            No brands yet — add one to start tracking the relationship.
          </CardContent>
        </Card>
      ) : sorted.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-xs text-muted-foreground">
            No brands match &quot;{query}&quot;.
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead>
                  <button
                    type="button"
                    onClick={() => toggleSort("name")}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    Brand
                    <NameSortIcon className="size-3" />
                  </button>
                </TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Campaigns</TableHead>
                <TableHead className="text-right">
                  <button
                    type="button"
                    onClick={() => toggleSort("revenue")}
                    className="ml-auto inline-flex items-center gap-1 hover:text-foreground"
                  >
                    Revenue
                    <RevenueSortIcon className="size-3" />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    type="button"
                    onClick={() => toggleSort("lastCollabDate")}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    Last collab
                    <LastCollabSortIcon className="size-3" />
                  </button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((row) => {
                const status = brandStatusStyle(row.status);
                return (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/brands/${row.id}`)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Avatar size="sm">
                          <AvatarImage src={row.logoUrl ?? undefined} alt="" />
                          <AvatarFallback>{row.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span className="max-w-40 truncate">{row.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.contactName ? <span className="truncate text-foreground">{row.contactName}</span> : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.agencyName ? `Agency · ${row.agencyName}` : "Direct"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant} className={status.className}>
                        {row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {row.campaignCount}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(row.revenue)}</TableCell>
                    <TableCell className="text-muted-foreground">{row.lastCollabDate ?? "—"}</TableCell>
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
