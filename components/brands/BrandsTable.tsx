"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  BRAND_FILTER_TABS,
  DEFAULT_BRAND_SORT,
  brandStatusStyle,
  filterBrandRows,
  isBrandFilter,
  missingBrandDetailsLabel,
  sortBrandRows,
  type BrandFilter,
  type BrandRow,
  type BrandSort,
  type BrandSortColumn,
} from "@/lib/brands";
import { formatMoney } from "@/lib/invoice";
import { cn } from "@/lib/utils";

interface BrandsTableProps {
  rows: BrandRow[];
}

function campaignsLabel(count: number): string {
  return count === 1 ? "1 campaign" : `${count} campaigns`;
}

function SortIcon({ active, direction }: { active: boolean; direction: BrandSort["direction"] }) {
  const Icon = !active ? ArrowUpDown : direction === "asc" ? ArrowUp : ArrowDown;
  return <Icon className="size-3" />;
}

/** The amber dot marking a brand still missing a photo or a contact. */
function MissingDetailsDot({ label }: { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          aria-label={label}
          className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-amber-500 ring-2 ring-background"
        />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function BrandIdentity({ row }: { row: BrandRow }) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative shrink-0">
        <Avatar size="sm">
          <AvatarImage src={row.logoUrl ?? undefined} alt="" />
          <AvatarFallback>{row.name.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        {row.missingDetails && <MissingDetailsDot label={missingBrandDetailsLabel(row.missingDetails)} />}
      </div>
      {/* The agency sits under the name rather than in a column of its own:
          it qualifies who the brand is, and as a column it was the word
          "Direct" repeated down the page. */}
      <div className="min-w-0">
        <p className="truncate font-medium">{row.name}</p>
        {row.agencyName && <p className="truncate text-muted-foreground">via {row.agencyName}</p>}
      </div>
    </div>
  );
}

export function BrandsTable({ rows }: BrandsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Tab and search live in the URL so a stat tile can link straight into a
  // view and the view survives a round-trip through a brand's detail page.
  // Same wiring as CampaignsTable.
  const tabParam = searchParams.get("tab");
  const tab: BrandFilter = isBrandFilter(tabParam) ? tabParam : "all";
  const queryParam = searchParams.get("q") ?? "";

  const [query, setQuery] = useState(queryParam);
  const [sort, setSort] = useState<BrandSort>(DEFAULT_BRAND_SORT);

  // Adopt the URL value when it changes from the outside (a tab click,
  // browser back/forward): the sanctioned "reset state on prop change" pattern.
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

  function toggleSort(column: BrandSortColumn) {
    setSort((current) =>
      current.column === column
        ? { column, direction: current.direction === "asc" ? "desc" : "asc" }
        : { column, direction: column === "name" ? "asc" : "desc" }
    );
  }

  const visible = sortBrandRows(filterBrandRows(rows, { filter: tab, query }), sort);
  const filtersActive = tab !== "all" || query.trim().length > 0;

  function clearFilters() {
    setQuery("");
    setTab("all");
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-xs text-muted-foreground">
          No brands yet. Add one to start tracking the relationship.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            {BRAND_FILTER_TABS.map((entry) => (
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
            placeholder="Search brands, agencies, contacts..."
            className="pl-7"
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-3 py-6 text-xs text-muted-foreground">
            No brands match this view.
            {filtersActive && (
              <Button size="sm" variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Seven columns became five: the agency moved under the brand name
              and the campaign count under the revenue it produced, so each
              column now holds a fact and its qualifier instead of spreading
              one thought across two headers. Nothing is hidden. */}
          <div className="hidden overflow-x-auto rounded-md border border-border md:block">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border bg-muted/40 hover:bg-muted/40 [&>th]:text-muted-foreground">
                  <TableHead>
                    <button
                      type="button"
                      onClick={() => toggleSort("name")}
                      className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                      Brand
                      <SortIcon active={sort.column === "name"} direction={sort.direction} />
                    </button>
                  </TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">
                    <button
                      type="button"
                      onClick={() => toggleSort("revenue")}
                      className="ml-auto inline-flex items-center gap-1 hover:text-foreground"
                    >
                      Revenue
                      <SortIcon active={sort.column === "revenue"} direction={sort.direction} />
                    </button>
                  </TableHead>
                  <TableHead className="text-right">
                    <button
                      type="button"
                      onClick={() => toggleSort("lastCollabDate")}
                      className="ml-auto inline-flex items-center gap-1 hover:text-foreground"
                    >
                      Last collab
                      <SortIcon active={sort.column === "lastCollabDate"} direction={sort.direction} />
                    </button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((row) => {
                  const status = brandStatusStyle(row.status);
                  return (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/brands/${row.id}`)}
                    >
                      <TableCell className="max-w-56">
                        <BrandIdentity row={row} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.contactName ? <span className="text-foreground">{row.contactName}</span> : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant} className={status.className}>
                          {row.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.campaignCount === 0 ? (
                          // No deals on the sheet: a dash says it, and "0
                          // campaigns" under it would only say it twice.
                          <span className="text-muted-foreground">-</span>
                        ) : (
                          <>
                            {row.revenue > 0 ? formatMoney(row.revenue) : <span className="text-muted-foreground">-</span>}
                            <span className="block text-muted-foreground">{campaignsLabel(row.campaignCount)}</span>
                          </>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {row.lastCollabDate ?? "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile: stacked cards. The table needs five columns to say
              anything, and five columns do not fit a phone: scrolled sideways
              it showed the brand name and nothing that qualifies it. */}
          <ul className="space-y-2 md:hidden">
            {visible.map((row) => {
              const status = brandStatusStyle(row.status);
              return (
                <li key={row.id}>
                  <Card size="sm">
                    <CardContent>
                      <Link href={`/brands/${row.id}`} className="block space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <BrandIdentity row={row} />
                          <Badge variant={status.variant} className={cn("shrink-0", status.className)}>
                            {row.status}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 tabular-nums text-muted-foreground">
                          <span>
                            {row.contactName ?? "No contact"}
                          </span>
                          {row.campaignCount > 0 && (
                            <span>
                              {/* A dash for zero would read as missing data
                                  inline; a barter deal billed nothing and the
                                  campaign count is the whole fact. */}
                              {row.revenue > 0 && (
                                <>
                                  <span className="text-foreground">{formatMoney(row.revenue)}</span>{" "}
                                  ·{" "}
                                </>
                              )}
                              {campaignsLabel(row.campaignCount)}
                            </span>
                          )}
                          {row.lastCollabDate && <span>Last {row.lastCollabDate}</span>}
                        </div>
                      </Link>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>

          <p className="text-xs text-muted-foreground">
            {visible.length === rows.length
              ? `${rows.length} brand${rows.length === 1 ? "" : "s"}`
              : `${visible.length} of ${rows.length} brands`}
          </p>
        </>
      )}
    </div>
  );
}
