import type { Campaign, CampaignPaymentStatus, CampaignType } from "@/repositories/campaigns";
import type { Brand } from "@/repositories/brands";

// View-model for the "Link to brand" picker: same "flat option list, never
// the full domain object" discipline as lib/invoice.ts's buildInvoiceBrandOptions.
export interface CampaignBrandOption {
  id: string;
  name: string;
}

export function buildCampaignBrandOptions(brands: Brand[]): CampaignBrandOption[] {
  return [...brands]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((brand) => ({ id: brand.id, name: brand.name }));
}

// The fixed option lists for each field: kept client-safe (no "server-only")
// since the quick-add form renders these as <Select> options. "Scam" is a
// valid Type (inherited from the original spreadsheet's data) but isn't
// offered when adding a new deal; it's something you'd mark after the fact.
export const CAMPAIGN_TYPES: CampaignType[] = ["Barter", "Paid", "Barter+Paid"];
export const REEL_OPTIONS = ["1 Reel", "2 Reels", "5 Reels"];
export const STORY_OPTIONS = ["1 Story", "2 Story", "5 Stories", "None"];
export const STATUS_OPTIONS = [
  "Discussion",
  "In Route",
  "Brainstorming",
  "Todo",
  "Ready to Upload",
  "Completed",
  "Cancelled",
  "Redacted",
];

// Manually settable from the campaign form (unlike the dashboard's
// "Mark received" quick actions, this covers barter-only deals too, which
// PaymentsDueCard/NeedsAttentionCard deliberately skip: see
// lib/dashboardAttention.ts).
export const PAYMENT_STATUS_OPTIONS: CampaignPaymentStatus[] = ["unknown", "pending", "received"];

export function paymentStatusLabel(status: CampaignPaymentStatus): string {
  return status === "unknown" ? "Not tracked" : status[0].toUpperCase() + status.slice(1);
}

// Sheet dates are entered as "DD/MM/YYYY"; undated rows sort last.
function parseSheetDate(date: string): number {
  const match = date.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return Number.NEGATIVE_INFINITY;
  const [, day, month, year] = match;
  return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
}

// The sheet's dates are DD/MM/YYYY; <input type="date"> gives/needs yyyy-mm-dd.
export function toSheetDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return isoDate;
  return `${day}/${month}/${year}`;
}

// Inverse of toSheetDate, for prefilling an edit form's <input type="date">
// from a value read back out of the sheet. Returns "" when unparsable so
// callers can fall back to a sensible default instead of feeding the <input>
// a value it will silently reject.
export function toIsoDate(sheetDate: string): string {
  const match = sheetDate.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return "";
  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export interface SplitCampaigns {
  active: Campaign[];
  past: Campaign[];
}

export function splitCampaigns(items: Campaign[]): SplitCampaigns {
  const active = items
    .filter((item) => item.stage === "active")
    .sort((a, b) => parseSheetDate(a.date) - parseSheetDate(b.date));
  const past = items
    .filter((item) => item.stage === "past")
    .sort((a, b) => parseSheetDate(b.date) - parseSheetDate(a.date));
  return { active, past };
}

export interface CampaignStats {
  total: number;
  paid: number;
  barter: number;
  cancelled: number;
  highestValue: Campaign | null;
}

export function computeCampaignStats(items: Campaign[]): CampaignStats {
  let paid = 0;
  let barter = 0;
  let cancelled = 0;
  let highestValue: Campaign | null = null;

  for (const item of items) {
    if (item.status.trim().toLowerCase() === "cancelled") {
      cancelled += 1;
      continue;
    }
    const type = item.type.trim().toLowerCase();
    if (type.includes("paid")) paid += 1;
    if (type.includes("barter")) barter += 1;
    if (!highestValue || item.total > highestValue.total) highestValue = item;
  }

  return { total: items.length - cancelled, paid, barter, cancelled, highestValue };
}

// --- Full-table view (/campaigns): filtering, sorting -----------------------
// Kept here (not in the client table component) so the list's business rules
// stay testable and out of the UI, per the project's architecture guide: 
// same split as lib/invoice.ts's filterInvoices/sortInvoices.

export type CampaignFilter = "all" | "active" | "completed" | "pending-payment" | "cancelled";

export const CAMPAIGN_FILTER_TABS: { value: CampaignFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "pending-payment", label: "Pending payment" },
  { value: "cancelled", label: "Cancelled" },
];

export function isCampaignFilter(value: string | null | undefined): value is CampaignFilter {
  return CAMPAIGN_FILTER_TABS.some((tab) => tab.value === value);
}

function matchesCampaignFilter(item: Campaign, filter: CampaignFilter): boolean {
  const status = item.status.trim().toLowerCase();
  switch (filter) {
    case "all":
      return true;
    case "active":
      return item.stage === "active";
    case "completed":
      return status === "completed";
    case "pending-payment":
      return item.paymentStatus === "pending";
    case "cancelled":
      return status === "cancelled" || status === "redacted";
  }
}

function matchesCampaignQuery(item: Campaign, needle: string): boolean {
  if (!needle) return true;
  return (
    item.brand.toLowerCase().includes(needle) ||
    item.campaign.toLowerCase().includes(needle) ||
    item.invoiceId.toLowerCase().includes(needle) ||
    item.notes.toLowerCase().includes(needle)
  );
}

export function filterCampaigns(
  items: Campaign[],
  { filter, query }: { filter: CampaignFilter; query: string }
): Campaign[] {
  const needle = query.trim().toLowerCase();
  return items.filter(
    (item) => matchesCampaignFilter(item, filter) && matchesCampaignQuery(item, needle)
  );
}

export type CampaignSortColumn = "date" | "uploadDate" | "amount" | "barterValue" | "total" | "paymentDue" | "status";
export type SortDirection = "asc" | "desc";

// Pipeline order, so ascending reads roughly left-to-right through a deal's life.
const STATUS_ORDER = new Map(STATUS_OPTIONS.map((status, index) => [status.toLowerCase(), index]));

export function sortCampaigns(
  items: Campaign[],
  column: CampaignSortColumn,
  direction: SortDirection
): Campaign[] {
  const factor = direction === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    let delta: number;
    switch (column) {
      case "uploadDate":
        delta = parseSheetDate(a.uploadDate) - parseSheetDate(b.uploadDate);
        break;
      case "amount":
        delta = a.amount - b.amount;
        break;
      case "barterValue":
        delta = a.barterValue - b.barterValue;
        break;
      case "total":
        delta = a.total - b.total;
        break;
      case "paymentDue":
        delta = parseSheetDate(a.paymentDue) - parseSheetDate(b.paymentDue);
        break;
      case "status":
        delta =
          (STATUS_ORDER.get(a.status.trim().toLowerCase()) ?? STATUS_OPTIONS.length) -
          (STATUS_ORDER.get(b.status.trim().toLowerCase()) ?? STATUS_OPTIONS.length);
        break;
      default:
        delta = parseSheetDate(a.date) - parseSheetDate(b.date);
    }
    return factor * delta;
  });
}
