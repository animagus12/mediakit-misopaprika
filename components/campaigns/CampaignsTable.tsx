"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";
import { Badge, type badgeVariants } from "@/components/ui/badge";
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
import type { VariantProps } from "class-variance-authority";
import {
  CAMPAIGN_FILTER_TABS,
  filterCampaigns,
  isCampaignFilter,
  sortCampaigns,
  type CampaignBrandOption,
  type CampaignFilter,
  type CampaignSortColumn,
  type SortDirection,
} from "@/lib/campaigns";
import { formatMoney } from "@/lib/invoice";
import { cn } from "@/lib/utils";
import type { Campaign } from "@/repositories/campaigns";
import { EditCampaignSheet } from "./EditCampaignSheet";

const PAGE_SIZE = 25;

type SortState = { column: CampaignSortColumn; direction: SortDirection };

// Most recent deal first, until the creator picks another column.
const DEFAULT_SORT: SortState = { column: "date", direction: "desc" };

interface StatusStyle {
  variant: VariantProps<typeof badgeVariants>["variant"];
  className?: string;
}

// Same pipeline vocabulary/coloring as components/dashboard/DashboardCampaignsSection.tsx
// and components/brands/BrandCampaignsTab.tsx — duplicated rather than
// imported cross-feature, matching how this styling is already duplicated
// per-surface elsewhere in the app.
function statusStyle(status: string): StatusStyle {
  switch (status.toLowerCase()) {
    case "completed":
      return {
        variant: "outline",
        className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
      };
    case "cancelled":
      return { variant: "destructive" };
    case "todo":
      return {
        variant: "outline",
        className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
      };
    case "brainstorming":
      return {
        variant: "outline",
        className: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400",
      };
    case "ready to upload":
      return {
        variant: "outline",
        className: "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-400",
      };
    case "in route":
      return {
        variant: "outline",
        className: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
      };
    case "redacted":
      return { variant: "outline", className: "border-dashed text-muted-foreground/70" };
    default:
      return { variant: "secondary" };
  }
}

// Same convention as components/brands/BrandPaymentsTab.tsx's paymentStatusStyle.
function paymentStatusStyle(status: Campaign["paymentStatus"]): StatusStyle {
  switch (status) {
    case "received":
      return {
        variant: "outline",
        className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
      };
    case "pending":
      return {
        variant: "outline",
        className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
      };
    default:
      return { variant: "secondary" };
  }
}

function SortHeader({
  column,
  label,
  className,
  sort,
  onToggle,
}: {
  column: CampaignSortColumn;
  label: string;
  className?: string;
  sort: SortState;
  onToggle: (column: CampaignSortColumn) => void;
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

interface CampaignsTableProps {
  campaigns: Campaign[];
  brandOptions?: CampaignBrandOption[];
}

export function CampaignsTable({ campaigns, brandOptions = [] }: CampaignsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Tab and search live in the URL so the view is shareable and survives a
  // round-trip through an edit sheet.
  const tabParam = searchParams.get("tab");
  const tab: CampaignFilter = isCampaignFilter(tabParam) ? tabParam : "all";
  const queryParam = searchParams.get("q") ?? "";

  const [query, setQuery] = useState(queryParam);
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const [page, setPage] = useState(1);

  // Adopt the URL value when it changes from the outside (a tab click,
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

  function toggleSort(column: CampaignSortColumn) {
    setSort((current) =>
      current.column === column
        ? { column, direction: current.direction === "asc" ? "desc" : "asc" }
        : { column, direction: column === "status" ? "asc" : "desc" }
    );
  }

  const filtered = useMemo(
    () => filterCampaigns(campaigns, { filter: tab, query }),
    [campaigns, tab, query]
  );

  const sorted = useMemo(
    () => sortCampaigns(filtered, sort.column, sort.direction),
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
            {CAMPAIGN_FILTER_TABS.map((entry) => (
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
            placeholder="Search brand, campaign, invoice, notes..."
            className="pl-7"
          />
        </div>
      </div>

      {sorted.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-3 py-6 text-xs text-muted-foreground">
            No campaigns match this view.
            {filtersActive && (
              <Button size="sm" variant="outline" onClick={() => { setQuery(""); setTab("all"); }}>
                Clear filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="overflow-x-auto rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="sticky left-0 z-10 border-r border-border bg-muted">Brand</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Deliverables</TableHead>
                  <TableHead>
                    <SortHeader column="date" label="Date" sort={sort} onToggle={toggleSort} />
                  </TableHead>
                  <TableHead>
                    <SortHeader column="uploadDate" label="Upload" sort={sort} onToggle={toggleSort} />
                  </TableHead>
                  <TableHead>
                    <SortHeader column="status" label="Status" sort={sort} onToggle={toggleSort} />
                  </TableHead>
                  <TableHead className="text-right">
                    <SortHeader column="amount" label="Amount" className="ml-auto" sort={sort} onToggle={toggleSort} />
                  </TableHead>
                  <TableHead className="text-right">
                    <SortHeader column="barterValue" label="Barter" className="ml-auto" sort={sort} onToggle={toggleSort} />
                  </TableHead>
                  <TableHead className="text-right">
                    <SortHeader column="total" label="Total" className="ml-auto" sort={sort} onToggle={toggleSort} />
                  </TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>
                    <SortHeader column="paymentDue" label="Due" sort={sort} onToggle={toggleSort} />
                  </TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((campaign) => {
                  const status = statusStyle(campaign.status);
                  const payment = paymentStatusStyle(campaign.paymentStatus);
                  return (
                    <EditCampaignSheet
                      key={campaign.id}
                      campaign={campaign}
                      brandOptions={brandOptions}
                      trigger={
                        <TableRow className="group cursor-pointer">
                          <TableCell
                            className="sticky left-0 z-10 max-w-32 truncate border-r border-border bg-background font-medium group-hover:bg-muted/50"
                            title={campaign.brand}
                          >
                            {campaign.brand}
                          </TableCell>
                          <TableCell className="max-w-32 truncate text-muted-foreground" title={campaign.campaign}>
                            {campaign.campaign || "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{campaign.type || "—"}</TableCell>
                          <TableCell className="text-muted-foreground whitespace-nowrap">
                            {[campaign.reels, campaign.story].filter(Boolean).join(", ") || "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{campaign.date || "—"}</TableCell>
                          <TableCell className="text-muted-foreground">{campaign.uploadDate || "—"}</TableCell>
                          <TableCell>
                            <Badge variant={status.variant} className={status.className}>
                              {campaign.status || "Unknown"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{formatMoney(campaign.amount)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatMoney(campaign.barterValue)}</TableCell>
                          <TableCell className="text-right tabular-nums font-medium">
                            {formatMoney(campaign.total)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{campaign.invoiceId || "—"}</TableCell>
                          <TableCell>
                            <Badge variant={payment.variant} className={payment.className}>
                              {campaign.paymentStatus === "unknown" ? "—" : campaign.paymentStatus}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{campaign.paymentDue || "—"}</TableCell>
                          <TableCell className="text-muted-foreground">{campaign.paymentMethod || "—"}</TableCell>
                          <TableCell className="max-w-40 truncate text-muted-foreground" title={campaign.notes || undefined}>
                            {campaign.notes || "—"}
                          </TableCell>
                        </TableRow>
                      }
                    />
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {sorted.length <= PAGE_SIZE
                ? `${sorted.length} campaign${sorted.length === 1 ? "" : "s"}`
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
