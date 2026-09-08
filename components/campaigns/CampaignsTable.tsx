"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";
import { Badge, type badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  CAMPAIGN_SORT_GROUPS,
  DEFAULT_CAMPAIGN_SORT,
  filterCampaigns,
  isCampaignCancelled,
  isCampaignFilter,
  paymentDisplayStatus,
  sortCampaigns,
  type CampaignBrandOption,
  type CampaignFilter,
  type CampaignSort,
  type CampaignSortColumn,
  type CampaignSortOption,
  type PaymentDisplayStatus,
} from "@/lib/campaigns";
import type { EditorVideoOption } from "@/lib/contentPlan";
import { formatMoney } from "@/lib/invoice";
import { paymentTiming, type PaymentPunctuality } from "@/lib/paymentReliability";
import { usageTerm, type UsageState } from "@/lib/usageRights";
import { cn } from "@/lib/utils";
import type { Campaign } from "@/repositories/campaigns";
import { EditCampaignSheet } from "./EditCampaignSheet";

const PAGE_SIZE = 25;

interface StatusStyle {
  variant: VariantProps<typeof badgeVariants>["variant"];
  className?: string;
}

// Same pipeline vocabulary/coloring as components/dashboard/DashboardCampaignsSection.tsx
// and components/brands/BrandCampaignsTab.tsx: duplicated rather than
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
function paymentStatusStyle(status: PaymentDisplayStatus): StatusStyle {
  switch (status) {
    // Dashed and muted, not another red pill: the Status column already says
    // "Cancelled" in destructive, and saying it twice in one row shouts a fact
    // the row has stated. Same treatment "Redacted" gets in statusStyle above,
    // and for the same reason: it marks a row as moot, not as wrong.
    case "cancelled":
      return { variant: "outline", className: "border-dashed text-muted-foreground" };
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

// How a payment landed against the day it was promised for. Muted is the
// resting state on purpose: only lateness and an open overdue payment are
// worth colour, since a table where every row is tinted says nothing.
const TIMING_TONES: Record<PaymentPunctuality, string> = {
  early: "text-emerald-600 dark:text-emerald-400",
  "on-time": "text-emerald-600 dark:text-emerald-400",
  late: "text-amber-600 dark:text-amber-400",
  overdue: "text-destructive",
  waiting: "text-muted-foreground",
  untimed: "text-muted-foreground",
};

const USAGE_TONES: Record<UsageState, string> = {
  untracked: "text-muted-foreground",
  unstarted: "text-muted-foreground",
  active: "text-muted-foreground",
  expiring: "text-amber-600 dark:text-amber-400",
  expired: "text-destructive",
  paused: "text-muted-foreground",
  ended: "text-muted-foreground",
};

// The quiet second line every merged cell carries. Its own component because
// eight columns use it and the size/colour of a caption is exactly the sort of
// thing that drifts when it is retyped eight times. A step fainter than
// `muted-foreground` so that a cell reads as one fact and its qualifier rather
// than as two facts of equal weight, and tight-leaded so a two-line cell does
// not cost half again the height of a one-line one.
function Sub({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span className={cn("mt-0.5 block text-[11px] leading-4 text-muted-foreground/70", className)}>
      {children}
    </span>
  );
}

/**
 * A column header that sorts.
 *
 * A group with one option is a plain toggle, as it always was. A group with
 * several is a menu: merging columns left fewer headers than there are useful
 * orderings, and dropping the extra orderings to keep every header a single
 * click would have made the table tidier by making it answer less. A click on
 * the option already in force flips its direction, so the common case (sort by
 * this, now the other way) stays one click either way.
 */
function SortHeader({
  label,
  options,
  sort,
  onPick,
  className,
}: {
  label: string;
  options: CampaignSortOption[];
  sort: CampaignSort;
  onPick: (column: CampaignSortColumn) => void;
  className?: string;
}) {
  const active = options.find((option) => option.column === sort.column);
  const Icon = !active ? ArrowUpDown : sort.direction === "asc" ? ArrowUp : ArrowDown;
  const trigger = (
    <>
      {label}
      {/* Which of a group's orderings is in force is not readable from the
          header's own name, so an active secondary one says so. */}
      {active && options.length > 1 && options[0].column !== active.column && (
        <span className="font-normal text-muted-foreground">· {active.label}</span>
      )}
      <Icon className="size-3" />
    </>
  );
  const triggerClassName = cn(
    "inline-flex items-center gap-1 hover:text-foreground",
    active && "text-foreground",
    className
  );

  if (options.length === 1) {
    return (
      <button
        type="button"
        onClick={() => onPick(options[0].column)}
        className={triggerClassName}
        aria-label={`Sort by ${label}`}
      >
        {trigger}
      </button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={triggerClassName} aria-label={`Sort by ${label}`}>
        {trigger}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {options.map((option) => (
          <DropdownMenuItem key={option.column} onSelect={() => onPick(option.column)}>
            {option.label}
            {option.column === sort.column && (
              <span className="ml-auto text-muted-foreground">
                {sort.direction === "asc" ? "Ascending" : "Descending"}
              </span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The deal's invoice, as a link once the two records have actually been
 * reconciled (Campaign.invoiceId) and as plain text while it is still only a
 * number someone typed (Campaign.invoiceRef).
 *
 * The click has to be stopped: the row around it opens the edit sheet, and a
 * link that also opened a sheet behind the page it navigated to would be two
 * answers to one click.
 */
function InvoiceLink({ campaign }: { campaign: Campaign }) {
  if (!campaign.invoiceId) return <>{campaign.invoiceRef}</>;
  return (
    <Link
      href={`/invoices/${campaign.invoiceId}`}
      onClick={(event) => event.stopPropagation()}
      className="underline underline-offset-2 hover:text-foreground"
    >
      {campaign.invoiceRef || "Invoice"}
    </Link>
  );
}

interface CampaignsTableProps {
  campaigns: Campaign[];
  brandOptions?: CampaignBrandOption[];
  videoOptions?: EditorVideoOption[];
}

export function CampaignsTable({
  campaigns,
  brandOptions = [],
  videoOptions = [],
}: CampaignsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Tab and search live in the URL so the view is shareable and survives a
  // round-trip through an edit sheet.
  const tabParam = searchParams.get("tab");
  const tab: CampaignFilter = isCampaignFilter(tabParam) ? tabParam : "all";
  const queryParam = searchParams.get("q") ?? "";

  const [query, setQuery] = useState(queryParam);
  const [sort, setSort] = useState<CampaignSort>(DEFAULT_CAMPAIGN_SORT);
  const [page, setPage] = useState(1);

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

  function pickSort(column: CampaignSortColumn) {
    setSort((current) =>
      current.column === column
        ? { column, direction: current.direction === "asc" ? "desc" : "asc" }
        : { column, direction: column === "status" ? "asc" : "desc" }
    );
  }

  // Judged across every campaign rather than the filtered page, so the column
  // does not appear and vanish as the creator moves between tabs. Same
  // conditional-column shape as BrandInvoicesTab's margin column.
  const anyUsage = campaigns.some(
    (item) => item.usage.months > 0 || item.usage.renewals.length > 0
  );

  const filtered = filterCampaigns(campaigns, { filter: tab, query });
  const sorted = sortCampaigns(filtered, sort.column, sort.direction);

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
            placeholder="Search brand, campaign, invoice..."
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
          {/* Sixteen columns needed a horizontal scroll to exist at all, so no
              row could be read end to end. The fields are the same ones; what
              changed is that each column now holds a fact and its qualifier
              (the deal and what it was for, the total and how it splits, the
              payment and what settled it) instead of spreading one thought
              across four headers. Nothing is hidden and nothing is behind a
              switch: eight columns simply fit. */}
          <div className="overflow-x-auto rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border bg-muted/40 hover:bg-muted/40 [&>th]:text-muted-foreground">
                  <TableHead className="sticky left-0 z-10 border-r border-border bg-muted">Brand</TableHead>
                  <TableHead>Deal</TableHead>
                  <TableHead>
                    <SortHeader
                      label="Dates"
                      options={CAMPAIGN_SORT_GROUPS.dates}
                      sort={sort}
                      onPick={pickSort}
                    />
                  </TableHead>
                  <TableHead>
                    <SortHeader
                      label="Status"
                      options={CAMPAIGN_SORT_GROUPS.status}
                      sort={sort}
                      onPick={pickSort}
                    />
                  </TableHead>
                  <TableHead className="text-right">
                    <SortHeader
                      label="Value"
                      options={CAMPAIGN_SORT_GROUPS.value}
                      sort={sort}
                      onPick={pickSort}
                      className="ml-auto"
                    />
                  </TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>
                    <SortHeader
                      label="Due & paid"
                      options={CAMPAIGN_SORT_GROUPS.payment}
                      sort={sort}
                      onPick={pickSort}
                    />
                  </TableHead>
                  {anyUsage && <TableHead>Ad usage</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((campaign) => {
                  const status = statusStyle(campaign.status);
                  const paymentState = paymentDisplayStatus(campaign);
                  const payment = paymentStatusStyle(paymentState);
                  // A cancelled deal is owed nothing, so the days since its
                  // due date measure nothing either: computePaymentReliability
                  // drops these rows for the same reason, and a cell reading
                  // "250 days overdue" on a deal nobody is chasing is worse
                  // than a blank one.
                  const cancelled = isCampaignCancelled(campaign.status);
                  const timing = paymentTiming(campaign);
                  const term = usageTerm(campaign);
                  const deliverables = [campaign.reels, campaign.story].filter(Boolean).join(", ");
                  // Only when a deal is genuinely both: on a cash-only or
                  // barter-only deal the split is the total again, and the
                  // Deal column's type already says which kind it was.
                  const mixed = campaign.amount > 0 && campaign.barterValue > 0;
                  // Nothing was owed in cash, so a due date and a punctuality
                  // verdict describe a schedule that never existed. What the
                  // deal is actually waiting on is a parcel, so the column
                  // carries the one date that means anything: the day it came.
                  const barterOnly = campaign.amount <= 0 && campaign.barterValue > 0;
                  return (
                    <EditCampaignSheet
                      key={campaign.id}
                      campaign={campaign}
                      brandOptions={brandOptions}
                      videoOptions={videoOptions}
                      trigger={
                        <TableRow className="group cursor-pointer border-b border-border/50 bg-background">
                          {/* bg-inherit, so the sticky cell picks up whichever
                              of the stripe/hover backgrounds the row is
                              wearing instead of needing its own copy of each. */}
                          <TableCell
                            className="sticky left-0 z-10 max-w-44 border-r border-border bg-inherit px-3 py-2.5 align-top font-medium"
                            title={campaign.brand}
                          >
                            <span className="block truncate">{campaign.brand}</span>
                            {/* A deal named after its own brand says the brand
                                twice and nothing else. */}
                            {campaign.campaign && campaign.campaign !== campaign.brand && (
                              <Sub className="truncate font-normal">{campaign.campaign}</Sub>
                            )}
                          </TableCell>

                          <TableCell className="px-3 py-2.5 align-top text-muted-foreground">
                            {campaign.type}
                            {deliverables && <Sub>{deliverables}</Sub>}
                          </TableCell>

                          <TableCell className="px-3 py-2.5 align-top whitespace-nowrap text-muted-foreground tabular-nums">
                            {campaign.date}
                            {campaign.uploadDate && <Sub>Posted {campaign.uploadDate}</Sub>}
                          </TableCell>

                          <TableCell className="px-3 py-2.5 align-top">
                            <Badge variant={status.variant} className={status.className}>
                              {campaign.status || "Unknown"}
                            </Badge>
                          </TableCell>

                          <TableCell
                            className={cn(
                              "px-3 py-2.5 align-top text-right font-semibold tabular-nums",
                              campaign.total === 0 && "font-normal text-muted-foreground"
                            )}
                          >
                            {formatMoney(campaign.total)}
                            {mixed && (
                              <Sub className="font-normal">
                                {formatMoney(campaign.amount)} cash · {formatMoney(campaign.barterValue)} barter
                              </Sub>
                            )}
                          </TableCell>

                          <TableCell className="px-3 py-2.5 align-top">
                            {/* No badge on a deal whose payment was never tracked
                                either way: a pill reading "-" is a control that
                                looks broken rather than an answer. What is known
                                about it, the invoice and the method, still shows. */}
                            {paymentState !== "unknown" && (
                              <Badge variant={payment.variant} className={payment.className}>
                                {paymentState}
                              </Badge>
                            )}
                            {(campaign.invoiceRef || campaign.paymentMethod) && (
                              <Sub className={cn(paymentState === "unknown" && "mt-0")}>
                                <InvoiceLink campaign={campaign} />
                                {campaign.invoiceRef && campaign.paymentMethod && " · "}
                                {campaign.paymentMethod}
                              </Sub>
                            )}
                          </TableCell>

                          {/* The due date carries no "Due" label: the header says
                              it once, where twenty-five rows of it said nothing.
                              "Paid" stays, since it is what tells the two dates
                              apart, and it shares its line with the verdict on it
                              rather than taking a third line. A barter deal gets
                              one labelled date instead of the pair, since it has
                              no cash schedule for the pair to describe. */}
                          <TableCell className="px-3 py-2.5 align-top whitespace-nowrap text-muted-foreground tabular-nums">
                            {barterOnly ? (
                              <>
                                {campaign.paidDate && `Delivered ${campaign.paidDate}`}
                                {!campaign.paidDate &&
                                  campaign.paymentDue &&
                                  `Expected ${campaign.paymentDue}`}
                              </>
                            ) : (
                              <>
                                {campaign.paymentDue}
                                {!cancelled && campaign.paidDate && (
                                  <Sub>
                                    Paid {campaign.paidDate}
                                    {timing.label && (
                                      <span className={TIMING_TONES[timing.punctuality]}>
                                        {" "}
                                        · {timing.label}
                                      </span>
                                    )}
                                  </Sub>
                                )}
                                {!cancelled && !campaign.paidDate && timing.label && (
                                  <Sub className={TIMING_TONES[timing.punctuality]}>{timing.label}</Sub>
                                )}
                              </>
                            )}
                          </TableCell>

                          {anyUsage && (
                            <TableCell className="px-3 py-2.5 align-top whitespace-nowrap text-muted-foreground">
                              {term.state !== "untracked" && (
                                <>
                                  <span className={cn("block", USAGE_TONES[term.state])}>{term.label}</span>
                                  <Sub>
                                    {term.totalMonths} month{term.totalMonths === 1 ? "" : "s"}
                                    {term.termCount > 1 ? ` · ${term.termCount} terms` : ""}
                                  </Sub>
                                </>
                              )}
                            </TableCell>
                          )}
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
