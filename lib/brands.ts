import type { VariantProps } from "class-variance-authority";
import type { badgeVariants } from "@/components/ui/badge";
import type { Agency } from "@/repositories/agencies";
import type { Brand, BrandStatus } from "@/repositories/brands";
import type { Contact } from "@/repositories/contacts";
import type { MediaKitLogo } from "@/repositories/mediakit";
import type { BrandCampaignRecord } from "@/repositories/brandCampaigns";
import { EMPTY_STATS, recordsForBrand, type BrandStats } from "./brandCampaignStats";
import { primaryContactForBrand } from "./contacts";
import { BLANK_LOGO } from "./mediakit";

// Kept client-safe (no "server-only") since forms render these as <Select>
// options — mirrors lib/collaborations.ts's STATUS_OPTIONS.
export const BRAND_STATUS_OPTIONS: BrandStatus[] = [
  "Lead",
  "Contacted",
  "Negotiating",
  "Worked With",
  "Active",
  "Dormant",
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
// header, and the create/edit forms — not coincidentally similar strings
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
    case "Cancelled":
    case "Do Not Contact":
      return { variant: "destructive" };
    case "Lead":
    default:
      return { variant: "secondary" };
  }
}

const LEAD_STATUSES = new Set<BrandStatus>(["Lead", "Contacted", "Negotiating"]);

// Statuses where an incomplete profile isn't worth nagging about: a Lead
// hasn't been worked with yet (no contact is normal), and Cancelled/Do Not
// Contact are dead ends — nothing left to fill in for either.
const STATUSES_EXEMPT_FROM_DETAILS_NUDGE = new Set<BrandStatus>(["Lead", "Cancelled", "Do Not Contact"]);

export interface MissingBrandDetails {
  photo: boolean;
  contact: boolean;
}

// A brand worth having a real profile for (see STATUSES_EXEMPT_FROM_DETAILS_NUDGE)
// that's still missing a photo or a reachable contact — most commonly one
// just auto-created from a new campaign whose brand name didn't match
// anything on file (see resolveOrCreateBrandId in app/(dashboard)/actions.ts),
// which starts with neither. null when the brand is exempt or complete.
export function missingBrandDetails(brand: Brand, hasContact: boolean): MissingBrandDetails | null {
  if (STATUSES_EXEMPT_FROM_DETAILS_NUDGE.has(brand.status)) return null;
  const photo = !brand.logoUrl;
  const contact = !hasContact;
  return photo || contact ? { photo, contact } : null;
}

// "Missing photo & contact" / "Missing photo" / "Missing contact" — for the
// dot's hover title and the brand detail page's banner.
export function missingBrandDetailsLabel(missing: MissingBrandDetails): string {
  const parts = [missing.photo && "photo", missing.contact && "contact"].filter(Boolean);
  return `Missing ${parts.join(" & ")}`;
}

export interface BrandPipelineStats {
  totalBrands: number;
  activeBrands: number;
  workedWith: number;
  leads: number;
  totalRevenue: number;
  pendingPayments: number;
}

// Drives the /brands stat cards — pipeline counts come from Brand.status,
// money figures roll up each brand's sheet-linked BrandStats (see
// lib/brandCampaignStats.ts) keyed by name.
export function computePipelineStats(brands: Brand[], statsByBrand: Map<string, BrandStats>): BrandPipelineStats {
  const result: BrandPipelineStats = {
    totalBrands: brands.length,
    activeBrands: 0,
    workedWith: 0,
    leads: 0,
    totalRevenue: 0,
    pendingPayments: 0,
  };
  for (const brand of brands) {
    if (brand.status === "Active") result.activeBrands += 1;
    if (brand.status === "Worked With") result.workedWith += 1;
    if (LEAD_STATUSES.has(brand.status)) result.leads += 1;
    const stats = statsByBrand.get(brand.name) ?? EMPTY_STATS;
    result.totalRevenue += stats.totalReceived;
    result.pendingPayments += stats.pending;
  }
  return result;
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
  searchText: string; // lowercase, pre-joined — what the search bar filters against
}

// A brand whose only sheet-linked deal(s) all got cancelled — the Status
// column should surface that plainly rather than keep showing whatever
// pipeline status (e.g. "Worked With") it was given on import.
function isCancelledOnly(records: BrandCampaignRecord[]): boolean {
  return records.length > 0 && records.every((record) => record.status.trim().toLowerCase() === "cancelled");
}

// View-model for the /brands table — joins in the agency name and primary
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

// A real collaboration on record, not just a lead in the pipeline — mirrors
// what "past collaborations" is supposed to mean on the media kit.
const MEDIA_KIT_ELIGIBLE_STATUSES = new Set<BrandStatus>(["Worked With", "Active"]);

// Feeds the media kit generator's "Sync from brands" button (MediaKitLogoGrid.tsx)
// — brand logo becomes the media kit collab logo image, brand website becomes
// its click-through link. A brand qualifies on pipeline status, or on having
// at least one paid invoice (`paidBrandIds`) — a paid invoice is proof of a
// real collaboration regardless of how the status was last set by hand.
export function brandLogosForMediaKit(
  brands: Brand[],
  paidBrandIds: ReadonlySet<string> = new Set()
): MediaKitLogo[] {
  return brands
    .filter((brand): brand is Brand & { logoUrl: string } =>
      (MEDIA_KIT_ELIGIBLE_STATUSES.has(brand.status) || paidBrandIds.has(brand.id)) && Boolean(brand.logoUrl)
    )
    .map((brand) => ({ src: brand.logoUrl, url: brand.website }));
}

// The reverse direction — media kit logos not yet linked to any brand, for
// MediaKitLogosSection.tsx's one-time "assign instead of re-upload" list.
// Excludes the blank placeholder slot and anything already matched by
// image URL to an existing brand.
export function unassignedMediaKitLogos(logos: MediaKitLogo[], brands: Brand[]): MediaKitLogo[] {
  const assignedSrcs = new Set(
    brands.map((brand) => brand.logoUrl).filter((src): src is string => Boolean(src))
  );
  return logos.filter((logo) => logo.src !== BLANK_LOGO && !assignedSrcs.has(logo.src));
}
