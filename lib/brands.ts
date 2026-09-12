import type { VariantProps } from "class-variance-authority";
import type { badgeVariants } from "@/components/ui/badge";
import type { Agency } from "@/repositories/agencies";
import type { Brand, BrandStatus } from "@/repositories/brands";
import type { Contact } from "@/repositories/contacts";
import type { MediaKitLogo } from "@/repositories/mediakit";
import type { BrandCampaignRecord } from "@/repositories/brandCampaigns";
import { EMPTY_STATS, parseSheetDate, recordsForBrand, type BrandStats } from "./brandCampaignStats";
import { primaryContactForBrand } from "./contacts";
import { BLANK_LOGO } from "./mediakit";

// Kept client-safe (no "server-only") since forms render these as <Select>
// options: mirrors lib/collaborations.ts's STATUS_OPTIONS.
export const BRAND_STATUS_OPTIONS: BrandStatus[] = [
  "Lead",
  "Contacted",
  "Negotiating",
  "Worked With",
  "Active",
  "Dormant",
  "Passed",
  "Went Cold",
  "Cancelled",
  "Do Not Contact",
];

interface StatusStyle {
  variant: VariantProps<typeof badgeVariants>["variant"];
  className?: string;
}

// Centralized (unlike the Campaign/EditorTransaction statusStyle
// helpers, each duplicated per-feature) since BrandStatus is one fixed
// 7-value vocabulary reused verbatim across the list table, the detail
// header, and the create/edit forms: not coincidentally similar strings
// from two unrelated domains.
export function brandStatusStyle(status: BrandStatus): StatusStyle {
  switch (status) {
    case "Active":
      return {
        variant: "outline",
        className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
      };
    case "Worked With":
      return {
        variant: "outline",
        className: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400",
      };
    case "Negotiating":
      return {
        variant: "outline",
        className: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400",
      };
    case "Contacted":
      return {
        variant: "outline",
        className: "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-400",
      };
    case "Dormant":
      return { variant: "outline", className: "border-dashed text-muted-foreground/70" };
    // A lead that ended, which is not the same as a deal that was killed:
    // muted rose reads as a loss without borrowing the destructive variant
    // that Cancelled and Do Not Contact need to stay louder than.
    case "Passed":
    case "Went Cold":
      return {
        variant: "outline",
        className: "border-rose-500/25 bg-rose-500/5 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400",
      };
    case "Cancelled":
    case "Do Not Contact":
      return { variant: "destructive" };
    case "Lead":
    default:
      return { variant: "secondary" };
  }
}

const LEAD_STATUSES = new Set<BrandStatus>(["Lead", "Contacted", "Negotiating"]);

// A relationship that actually happened, as opposed to one still being
// negotiated or one that ended. "Active" is a brand currently running work,
// "Worked With" is one that has and could again: both are real collaborations,
// which is the same test the media kit's past-collabs grid applies (see
// brandLogosForMediaKit below).
const WORKING_STATUSES = new Set<BrandStatus>(["Active", "Worked With"]);

// Statuses where an incomplete profile isn't worth nagging about: a Lead
// hasn't been worked with yet (no contact is normal), and the four closed
// statuses are dead ends: nothing left to fill in for any of them.
const STATUSES_EXEMPT_FROM_DETAILS_NUDGE = new Set<BrandStatus>([
  "Lead",
  "Passed",
  "Went Cold",
  "Cancelled",
  "Do Not Contact",
]);

export interface MissingBrandDetails {
  photo: boolean;
  contact: boolean;
}

// A brand worth having a real profile for (see STATUSES_EXEMPT_FROM_DETAILS_NUDGE)
// that's still missing a photo or a reachable contact: most commonly one
// just auto-created from a new campaign whose brand name didn't match
// anything on file (see resolveOrCreateBrandId in app/(dashboard)/actions.ts),
// which starts with neither. null when the brand is exempt or complete.
export function missingBrandDetails(brand: Brand, hasContact: boolean): MissingBrandDetails | null {
  if (STATUSES_EXEMPT_FROM_DETAILS_NUDGE.has(brand.status)) return null;
  const photo = !brand.logoUrl;
  const contact = !hasContact;
  return photo || contact ? { photo, contact } : null;
}

// "Missing photo & contact" / "Missing photo" / "Missing contact": for the
// dot's hover title and the brand detail page's banner.
export function missingBrandDetailsLabel(missing: MissingBrandDetails): string {
  const parts = [missing.photo && "photo", missing.contact && "contact"].filter(Boolean);
  return `Missing ${parts.join(" & ")}`;
}

export interface BrandRow {
  id: string;
  name: string;
  logoUrl: string | null;
  status: BrandStatus;
  agencyName: string | null;
  contactName: string | null;
  campaignCount: number;
  revenue: number;
  lastCollabDate: string | null;
  missingDetails: MissingBrandDetails | null;
  searchText: string; // lowercase and pre-joined, which is what the search bar filters against
}

// A brand whose only sheet-linked deal(s) all got cancelled: the Status
// column should surface that plainly rather than keep showing whatever
// pipeline status (e.g. "Worked With") it was given on import.
function isCancelledOnly(records: BrandCampaignRecord[]): boolean {
  return records.length > 0 && records.every((record) => record.status.trim().toLowerCase() === "cancelled");
}

// View-model for the /brands table: joins in the agency name and primary
// contact server-side so the client table only has to filter/sort flat
// fields per keystroke, not repeat the brand/agency/contact join.
export function buildBrandRows(
  brands: Brand[],
  agencies: Agency[],
  contacts: Contact[],
  statsByBrand: Map<string, BrandStats>,
  records: BrandCampaignRecord[]
): BrandRow[] {
  const agencyById = new Map(agencies.map((agency) => [agency.id, agency]));
  return brands.map((brand) => {
    const agency = brand.agencyId ? (agencyById.get(brand.agencyId) ?? null) : null;
    const contact = primaryContactForBrand(brand, contacts);
    const stats = statsByBrand.get(brand.name) ?? EMPTY_STATS;
    const status: BrandStatus = isCancelledOnly(recordsForBrand(brand, records)) ? "Cancelled" : brand.status;
    const searchText = [brand.name, agency?.name, contact?.name, contact?.phone]
      .filter((part): part is string => Boolean(part))
      .join(" ")
      .toLowerCase();
    return {
      id: brand.id,
      name: brand.name,
      logoUrl: brand.logoUrl,
      status,
      agencyName: agency?.name ?? null,
      contactName: contact?.name ?? null,
      campaignCount: stats.campaignCount,
      revenue: stats.totalBilled,
      lastCollabDate: stats.lastCollabDate,
      missingDetails: missingBrandDetails(brand, Boolean(contact)),
      searchText,
    };
  });
}

export type BrandSortColumn = "name" | "revenue" | "lastCollabDate";
export type SortDirection = "asc" | "desc";

export interface BrandSort {
  column: BrandSortColumn;
  direction: SortDirection;
}

export const DEFAULT_BRAND_SORT: BrandSort = { column: "name", direction: "asc" };

// Here rather than in the table for the same reason filterBrandRows is: what
// the list can be ordered by is the list's rule, not its markup. Mirrors
// sortCampaigns in lib/campaigns.ts.
export function sortBrandRows(rows: BrandRow[], { column, direction }: BrandSort): BrandRow[] {
  const sign = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (column === "revenue") return sign * (a.revenue - b.revenue);
    if (column === "lastCollabDate") {
      return sign * (parseSheetDate(a.lastCollabDate) - parseSheetDate(b.lastCollabDate));
    }
    return sign * a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

/**
 * The three things a brand can be, from the creator's point of view: a
 * conversation worth chasing, a relationship that is live, or one there is
 * nothing to do about.
 *
 * Coarser than BrandStatus on purpose. Ten status pills are the right
 * vocabulary for one row, and the wrong one for a tab strip: the question a
 * tab answers is "which part of the list am I looking at", and there are only
 * three parts. The Status column still names the exact status.
 */
export type BrandFilter = "all" | "pipeline" | "working" | "inactive";

export const BRAND_FILTER_TABS: { value: BrandFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pipeline", label: "Pipeline" },
  { value: "working", label: "Working" },
  { value: "inactive", label: "Inactive" },
];

export function isBrandFilter(value: string | null | undefined): value is BrandFilter {
  return BRAND_FILTER_TABS.some((tab) => tab.value === value);
}

// Matched against BrandRow.status, not Brand.status, so a brand the table is
// already showing as "Cancelled" (every deal on the sheet called off, see
// isCancelledOnly) files under Closed rather than under whatever it was
// imported as.
function matchesBrandFilter(row: BrandRow, filter: BrandFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "pipeline":
      return LEAD_STATUSES.has(row.status);
    case "working":
      return WORKING_STATUSES.has(row.status);
    // Everything that is neither: the four closed statuses plus Dormant,
    // which is not closed but is not asking for anything either. Written as
    // the complement so a status added later lands here instead of vanishing
    // from every tab.
    case "inactive":
      return !LEAD_STATUSES.has(row.status) && !WORKING_STATUSES.has(row.status);
  }
}

export function filterBrandRows(
  rows: BrandRow[],
  { filter, query }: { filter: BrandFilter; query: string }
): BrandRow[] {
  const needle = query.trim().toLowerCase();
  return rows.filter(
    (row) => matchesBrandFilter(row, filter) && (!needle || row.searchText.includes(needle))
  );
}

export interface BrandPipelineStats {
  totalBrands: number;
  /** Lead/Contacted/Negotiating: conversations that could still become deals. */
  pipeline: number;
  /** Active/Worked With: relationships that are live or have been. */
  working: number;
  totalRevenue: number;
  pendingPayments: number;
}

/**
 * Drives the /brands stat tiles: counts come from the rows, money figures roll
 * up each brand's sheet-linked BrandStats (see lib/brandCampaignStats.ts)
 * keyed by name.
 *
 * Takes rows rather than brands so the counts run through matchesBrandFilter,
 * the one rule the tabs also use. Counting Brand.status here instead would
 * disagree with the tab a tile links to for any brand the table is showing
 * under a derived status: a brand imported as "Worked With" whose only deals
 * were all cancelled sits in Inactive but would have been counted as working,
 * and the three groups would sum to more brands than exist.
 */
export function computePipelineStats(
  rows: BrandRow[],
  statsByBrand: Map<string, BrandStats>
): BrandPipelineStats {
  const result: BrandPipelineStats = {
    totalBrands: rows.length,
    pipeline: 0,
    working: 0,
    totalRevenue: 0,
    pendingPayments: 0,
  };
  for (const row of rows) {
    if (matchesBrandFilter(row, "pipeline")) result.pipeline += 1;
    if (matchesBrandFilter(row, "working")) result.working += 1;
    const stats = statsByBrand.get(row.name) ?? EMPTY_STATS;
    result.totalRevenue += stats.totalReceived;
    result.pendingPayments += stats.pending;
  }
  return result;
}

// Feeds the media kit generator's "Sync from brands" button (MediaKitLogoGrid.tsx)
//: brand logo becomes the media kit collab logo image, brand website becomes
// its click-through link. A brand qualifies on pipeline status, or on having
// at least one paid invoice (`paidBrandIds`): a paid invoice is proof of a
// real collaboration regardless of how the status was last set by hand.
export function brandLogosForMediaKit(
  brands: Brand[],
  paidBrandIds: ReadonlySet<string> = new Set()
): MediaKitLogo[] {
  return brands
    .filter((brand): brand is Brand & { logoUrl: string } =>
      (WORKING_STATUSES.has(brand.status) || paidBrandIds.has(brand.id)) && Boolean(brand.logoUrl)
    )
    .map((brand) => ({ src: brand.logoUrl, url: brand.website }));
}

// The reverse direction: media kit logos not yet linked to any brand, for
// MediaKitLogosSection.tsx's one-time "assign instead of re-upload" list.
// Excludes the blank placeholder slot and anything already matched by
// image URL to an existing brand.
export function unassignedMediaKitLogos(logos: MediaKitLogo[], brands: Brand[]): MediaKitLogo[] {
  const assignedSrcs = new Set(
    brands.map((brand) => brand.logoUrl).filter((src): src is string => Boolean(src))
  );
  return logos.filter((logo) => logo.src !== BLANK_LOGO && !assignedSrcs.has(logo.src));
}
