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

// The one terminal status that means the money question is closed rather than
// answered. Its own function because four files were each spelling out the
// same trim/lowercase comparison, and every one of them is making this same
// call.
//
// Narrower than isCampaignCalledOff below, and deliberately: this one decides
// what a badge *says*, and a row whose Status column reads "Redacted" must not
// have its payment column reading "cancelled".
export function isCampaignCancelled(status: string): boolean {
  return status.trim().toLowerCase() === "cancelled";
}

// Both terminal statuses that mean the deal never happened commercially.
// "Redacted" is the sheet's own word for a row written out of the record: the
// content calendar and the usage-rights selectors have always dropped it
// alongside "Cancelled", and the campaigns list files it under the Cancelled
// tab. The money figures were the one place that did not, so a redacted deal
// still counted toward lifetime earnings, toward a brand's total received, and
// toward the payment-reliability score.
//
// Every one of those now reads through here, so what "called off" means is
// settled in one place rather than in five copies that were already drifting.
const CALLED_OFF_STATUSES = new Set(["cancelled", "redacted"]);

export function isCampaignCalledOff(status: string): boolean {
  return CALLED_OFF_STATUSES.has(status.trim().toLowerCase());
}

/**
 * What a deal's payment column should read.
 *
 * "Not tracked" is the wrong answer for a cancelled deal: it says nobody
 * recorded whether the money came, when in fact there is no money to record.
 * Every projection in the app already treats a cancelled deal that way
 * (selectDuePayments drops it, selectAttentionItems skips it,
 * computePaymentReliability refuses to score it), so this only puts on screen
 * a rule the app has always followed silently.
 *
 * Derived rather than stored, and deliberately not a fourth
 * CampaignPaymentStatus. The stored field feeds the earnings totals, the
 * reliability score and the invoice sync; a value those have never seen would
 * have to be taught to each of them, and a second copy of "this deal was
 * cancelled" is a second copy that can disagree with the first.
 *
 * A received payment outranks the cancellation, because it is a fact about
 * money that actually moved: reading "cancelled" over a deal whose ₹5,000
 * landed would have the table contradicting the earnings page.
 */
export type PaymentDisplayStatus = CampaignPaymentStatus | "cancelled";

export function paymentDisplayStatus(deal: {
  status: string;
  paymentStatus: CampaignPaymentStatus;
}): PaymentDisplayStatus {
  if (deal.paymentStatus === "received") return "received";
  return isCampaignCancelled(deal.status) ? "cancelled" : deal.paymentStatus;
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

// A deal's own name is regularly left blank on the record, and a row reading
// "Campaign  created" helps nobody: the brand is what makes it findable, so
// it stands in. Shared by every caller that has to name a deal in a sentence
// (activity events, calendar rows, toasts).
export function campaignLabel(campaign: string, brand: string): string {
  return campaign.trim() || brand.trim() || "untitled deal";
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
}

export function computeCampaignStats(items: Campaign[]): CampaignStats {
  let paid = 0;
  let barter = 0;
  let cancelled = 0;

  for (const item of items) {
    if (isCampaignCalledOff(item.status)) {
      cancelled += 1;
      continue;
    }
    const type = item.type.trim().toLowerCase();
    if (type.includes("paid")) paid += 1;
    if (type.includes("barter")) barter += 1;
  }

  return { total: items.length - cancelled, paid, barter, cancelled };
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
    item.invoiceRef.toLowerCase().includes(needle)
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

export type CampaignSortColumn =
  | "date"
  | "uploadDate"
  | "amount"
  | "barterValue"
  | "total"
  | "paymentDue"
  | "paidDate"
  | "status";
export type SortDirection = "asc" | "desc";

export interface CampaignSort {
  column: CampaignSortColumn;
  direction: SortDirection;
}

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
      case "paidDate":
        delta = parseSheetDate(a.paidDate) - parseSheetDate(b.paidDate);
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

// --- Sort groups -----------------------------------------------------------
// Merging columns (see components/campaigns/CampaignsTable.tsx) leaves fewer
// headers than there are things worth sorting by, so a header owns a group
// rather than a single column: "Value" sorts by total, cash or barter value.
// The first entry is what a plain click on that header sorts by.
//
// Here rather than in the table for the same reason filterCampaigns and
// sortCampaigns are: what a column can be ordered by is the list's rule, not
// its markup.

export interface CampaignSortOption {
  column: CampaignSortColumn;
  label: string;
}

export const CAMPAIGN_SORT_GROUPS: Record<string, CampaignSortOption[]> = {
  dates: [
    { column: "date", label: "Deal date" },
    { column: "uploadDate", label: "Posted date" },
  ],
  status: [{ column: "status", label: "Status" }],
  value: [
    { column: "total", label: "Total value" },
    { column: "amount", label: "Cash amount" },
    { column: "barterValue", label: "Barter value" },
  ],
  payment: [
    { column: "paymentDue", label: "Due date" },
    { column: "paidDate", label: "Paid date" },
  ],
};

// Most recent deal first, until the creator picks another column.
export const DEFAULT_CAMPAIGN_SORT: CampaignSort = { column: "date", direction: "desc" };
