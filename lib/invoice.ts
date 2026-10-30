import type { VariantProps } from "class-variance-authority";
import type { badgeVariants } from "@/components/ui/badge";
import type { InvoiceFormState } from "@/components/invoice/types";
import type { InvoiceData, InvoiceLineItemInput } from "@/repositories/invoice";
import type { Invoice, InvoiceDisplayStatus, InvoiceStatus, NewInvoice } from "@/repositories/invoices";
import type { Brand } from "@/repositories/brands";
import type { Campaign } from "@/repositories/campaigns";
import type { Contact } from "@/repositories/contacts";
import type { EditorTransaction } from "@/repositories/editorTransactions";
import { campaignLabel, isCampaignCalledOff, toSheetDate } from "./campaigns";
import { contactsForBrand } from "./contacts";
import { parseSheetDate } from "./editorTransactions";
import { normalizeBrandName } from "./brandCampaignStats";
import { addDays, todayKey } from "./day";
import { financialYearsPresent, isInFinancialYear } from "./financialYear";
import { roundMoney } from "./money";

export interface InvoiceLineItem extends InvoiceLineItemInput {
  id: string;
}

// Kept client-safe (no "server-only") since the editor renders these as
// <Select> options: mirrors lib/editorTransactions.ts's status options.
export const INVOICE_STATUS_OPTIONS: InvoiceStatus[] = ["draft", "sent", "paid", "void"];

export function formatInvoiceStatus(status: InvoiceDisplayStatus): string {
  if (status === "partial") return "Partly paid";
  return status[0].toUpperCase() + status.slice(1);
}

/**
 * What an invoice's badge reads: "partial" for a draft or sent invoice part
 * of whose money has arrived (see its settlement in lib/payments.ts), its
 * status otherwise.
 */
export function invoiceDisplayStatus(invoice: Pick<Invoice, "status" | "settlement">): InvoiceDisplayStatus {
  if ((invoice.status === "draft" || invoice.status === "sent") && invoice.settlement.status === "partial") {
    return "partial";
  }
  return invoice.status;
}

export function formatMoney(amount: number): string {
  return `₹ ${Number(amount || 0).toLocaleString("en-IN")}`;
}

export function formatInvoiceDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export function isValidPanNumber(panNumber: string): boolean {
  return !panNumber.trim() || /^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(panNumber.trim());
}

export function validateInvoiceInput(input: NewInvoice): string | null {
  if (!input.invoiceNo.trim()) return "Enter an invoice number";
  if (input.items.length === 0) return "Add at least one line item";

  for (const [index, item] of input.items.entries()) {
    const lineNumber = index + 1;
    if (!item.desc.trim()) return `Enter a description for line ${lineNumber}`;
    if (!Number.isInteger(item.qty) || item.qty <= 0) {
      return `Enter a whole quantity greater than zero for line ${lineNumber}`;
    }
    if (!Number.isFinite(item.price) || item.price < 0) {
      return `Enter a valid non-negative price for line ${lineNumber}`;
    }
  }

  if (input.barter.enabled && (!Number.isFinite(input.barter.value) || input.barter.value < 0)) {
    return "Barter value must be a non-negative amount";
  }

  return null;
}

export function todayISO(offsetDays = 0): string {
  return addDays(todayKey(), offsetDays);
}

/**
 * The invoice editor, opened for one deal.
 *
 * `campaignId` fills every field from the deal and links the saved invoice to
 * it directly (a deal already invoiced opens that invoice instead). Brand and
 * campaign ride along for a deal the page can no longer find, so the editor
 * still starts from the right names.
 */
export function newInvoiceHref(brand: string, campaign: string, campaignId?: string): string {
  const params = new URLSearchParams();
  if (campaignId?.trim()) params.set("campaignId", campaignId.trim());
  if (brand.trim()) params.set("client", brand.trim());
  if (campaign.trim()) params.set("campaign", campaign.trim());
  const query = params.toString();
  return query ? `/invoices/new?${query}` : "/invoices/new";
}

export function buildInvoiceNumber(invoiceNo: string): string {
  return `MSP-INV-${String(invoiceNo || "").trim().padStart(4, "0")}`;
}

/**
 * Resolves a free-text invoice reference to the invoice record it names.
 *
 * The field is typed by hand and inconsistent: "MSP-INV-0007", "0007" and
 * "7" all mean the same invoice, so all three match. Returns null when the
 * reference is blank, a literal "-", or names an invoice that was never saved
 * as a record.
 *
 * Prefer resolveCampaignInvoice below when the caller holds a whole campaign:
 * a deal that has already been reconciled carries the real key, and matching
 * it back by number again would be answering a question already settled.
 */
export function findInvoiceByCampaignRef<T extends { invoiceNo: string }>(
  invoiceRef: string,
  invoices: T[]
): T | null {
  const needle = invoiceNoKey(invoiceRef);
  if (!needle || needle === "-") return null;
  return invoices.find((invoice) => invoiceNoKey(invoice.invoiceNo) === needle) ?? null;
}

/**
 * One invoice number however it was written: "MSP-INV-0012", "0012" and "12"
 * all answer "12". Every comparison between two invoice numbers goes through
 * this, since comparing the raw strings is how "12" once passed as unused
 * while "0012" was already saved.
 */
export function invoiceNoKey(invoiceNo: string): string {
  const bare = invoiceNo.trim().toLowerCase().replace(/^msp-inv-/, "");
  return /^\d+$/.test(bare) ? String(Number(bare)) : bare;
}

/** Whether `invoiceNo` names one of `numbers`. A blank number clashes with nothing. */
export function isInvoiceNoTaken(invoiceNo: string, numbers: string[]): boolean {
  const key = invoiceNoKey(invoiceNo);
  return key !== "" && numbers.some((number) => invoiceNoKey(number) === key);
}

/**
 * Every invoice number already spoken for: the saved invoices' own, and the
 * references deals quote before an invoice exists for them.
 *
 * Both, because they are one sequence to the brand reading them: a reference
 * a deal still quotes without an invoice, reused for another invoice, leaves
 * two documents with one number. A linked deal's reference is only a copy of
 * its invoice's number and is not counted again, so a stale copy can't push
 * the next number up and leave a gap.
 */
export function reservedInvoiceNumbers(
  invoices: { invoiceNo: string }[],
  campaigns: { invoiceRef: string; invoiceId: string | null }[]
): { invoiceNo: string }[] {
  return [
    ...invoices,
    ...campaigns.flatMap((campaign) => {
      if (campaign.invoiceId) return [];
      const match = campaign.invoiceRef.trim().match(/^MSP-INV-(\d+)$/i);
      return match ? [{ invoiceNo: match[1] }] : [];
    }),
  ];
}

/**
 * The invoice a deal is billed by: its foreign key when one has been written,
 * and the typed reference otherwise.
 *
 * The key wins because it survives what the reference does not: renumbering an
 * invoice, or two deals that happen to quote the same number. The fallback is
 * what keeps deals that predate the link (and ones whose invoice was raised
 * outside the app) resolving at all. A key pointing at a deleted invoice falls
 * through to the reference rather than answering null, since the reference may
 * still name something.
 */
export function resolveCampaignInvoice<T extends { id: string; invoiceNo: string }>(
  link: { invoiceId: string | null; invoiceRef: string },
  invoices: T[]
): T | null {
  if (link.invoiceId) {
    const linked = invoices.find((invoice) => invoice.id === link.invoiceId);
    if (linked) return linked;
  }
  return findInvoiceByCampaignRef(link.invoiceRef, invoices);
}

type InvoiceOwnerCandidate = Pick<Campaign, "id" | "brand" | "campaign" | "brandId" | "invoiceId" | "usage">;

/**
 * The deal an invoice bills, directly or through one of its renewals, or null
 * for an invoice raised on its own.
 */
export function invoiceOwner<C extends InvoiceOwnerCandidate>(
  invoiceId: string,
  campaigns: C[]
): { campaign: C; renewalId: string | null } | null {
  for (const campaign of campaigns) {
    if (campaign.invoiceId === invoiceId) return { campaign, renewalId: null };
    const renewal = campaign.usage.renewals.find((entry) => entry.invoiceId === invoiceId);
    if (renewal) return { campaign, renewalId: renewal.id };
  }
  return null;
}

/**
 * The invoice with the brand of the deal it bills.
 *
 * A linked invoice bills that deal's brand, whatever brand the invoice record
 * itself stores: most invoices were saved before they had a brand picker, and
 * an auto-raised one can be edited into another deal's invoice without its
 * brand being changed. Either left the invoice off its brand's page (billed to
 * "Mangoshake Media" or an office address, which no brand name matches) or on
 * the wrong one. A deal with no brand leaves the invoice's own in place.
 */
export function withLinkedBrand<T extends { id: string; brandId: string | null }>(
  invoice: T,
  campaigns: InvoiceOwnerCandidate[]
): T {
  const brandId = invoiceOwner(invoice.id, campaigns)?.campaign.brandId ?? invoice.brandId ?? null;
  return brandId === invoice.brandId ? invoice : { ...invoice, brandId };
}

/**
 * Each invoice's due date as DD/MM/YYYY, keyed by invoice id, for
 * withInvoiceDueDate. A void invoice bills nothing, so it sets no date, and
 * neither does one saved without a due date.
 */
export function invoiceDueDates(
  invoices: Pick<Invoice, "id" | "status" | "dueDate">[]
): Map<string, string> {
  const dueDates = new Map<string, string>();
  for (const invoice of invoices) {
    if (invoice.status === "void" || !invoice.dueDate) continue;
    dueDates.set(invoice.id, toSheetDate(invoice.dueDate));
  }
  return dueDates;
}

/**
 * The deal with its payment due dates taken from the invoices billing it.
 *
 * The invoice is where the due date is agreed and sent to the brand, so a
 * linked deal reads it from there rather than asking for it to be typed a
 * second time, and a date changed on the invoice moves the dashboard's timer
 * with it. The deal's own date only stands when no invoice sets one. The same
 * goes for each renewal and the invoice raised for it.
 */
export function withInvoiceDueDate(campaign: Campaign, dueDates: ReadonlyMap<string, string>): Campaign {
  const dealDue = campaign.invoiceId ? dueDates.get(campaign.invoiceId) : undefined;
  const renewals = campaign.usage.renewals.map((renewal) => {
    const renewalDue = renewal.invoiceId ? dueDates.get(renewal.invoiceId) : undefined;
    return renewalDue ? { ...renewal, paymentDue: renewalDue } : renewal;
  });
  return {
    ...campaign,
    paymentDue: dealDue ?? campaign.paymentDue,
    paymentDueFromInvoice: dealDue !== undefined,
    usage: { ...campaign.usage, renewals },
  };
}

/** The deal a linked invoice bills, as the invoice editor names it. */
export interface InvoiceLinkedCampaign {
  label: string;
  brandId: string | null;
  /** True for a renewal's invoice, which bills the licence extension. */
  renewal: boolean;
}

export function toInvoiceLinkedCampaign(
  owner: { campaign: InvoiceOwnerCandidate; renewalId: string | null } | null
): InvoiceLinkedCampaign | null {
  if (!owner) return null;
  const { campaign } = owner;
  return {
    label: [campaign.brand.trim(), campaign.campaign.trim()].filter(Boolean).join(" · "),
    brandId: campaign.brandId,
    renewal: owner.renewalId !== null,
  };
}

/** One invoice a deal can be linked to, for the edit sheet's invoice picker. */
export interface CampaignInvoiceOption {
  id: string;
  /** "MSP-INV-0014" */
  number: string;
  /** What it bills: its campaign name, or the client when it has none. */
  detail: string;
  /** The deal linked to it now, or null. Another deal's invoice is not offered. */
  linkedCampaignId: string | null;
  /** yyyy-mm-dd the deal's payment falls due once linked, or "" when this invoice sets none. */
  dueDate: string;
}

/**
 * Every invoice a deal could be billed by, newest number first, with the deal
 * each is linked to now.
 *
 * A renewal's invoice is left out: it bills a licence extension and is linked
 * to its renewal, and a deal pointing at it would count the renewal fee as the
 * deal's own. The linked deal is carried so each sheet can drop invoices
 * another deal already holds: one invoice bills one deal.
 */
export function buildCampaignInvoiceOptions(
  invoices: Pick<Invoice, "id" | "invoiceNo" | "campaignName" | "client" | "status" | "dueDate">[],
  campaigns: Pick<Campaign, "id" | "invoiceId" | "usage">[]
): CampaignInvoiceOption[] {
  const renewalInvoiceIds = new Set(
    campaigns.flatMap((campaign) => campaign.usage.renewals.map((renewal) => renewal.invoiceId))
  );
  return invoices
    .filter((invoice) => !renewalInvoiceIds.has(invoice.id))
    .map((invoice) => {
      const holder = campaigns.find((campaign) => campaign.invoiceId === invoice.id);
      return {
        id: invoice.id,
        number: buildInvoiceNumber(invoice.invoiceNo),
        detail: invoice.campaignName.trim() || invoice.client.name.trim(),
        linkedCampaignId: holder?.id ?? null,
        // Same rule as invoiceDueDates, so the sheet locks exactly the dates
        // the read will override.
        dueDate: invoice.status === "void" ? "" : invoice.dueDate,
      };
    })
    .sort((a, b) => b.number.localeCompare(a.number, undefined, { numeric: true }));
}

/** One deal a standalone invoice could be linked to before its first payment. */
export interface InvoiceDealOption {
  id: string;
  /** "Brand · Campaign" */
  label: string;
}

/**
 * The deals a standalone invoice could bill: cash deals no invoice bills yet
 * and not called off, the invoice's own brand first. Asked before its first
 * payment, so money for a deal is recorded on that deal and not twice.
 */
export function buildInvoiceDealOptions(
  invoice: Pick<Invoice, "brandId">,
  campaigns: Pick<Campaign, "id" | "brand" | "brandId" | "campaign" | "invoiceId" | "cash" | "status">[]
): InvoiceDealOption[] {
  return campaigns
    .filter((campaign) => !campaign.invoiceId && campaign.cash > 0 && !isCampaignCalledOff(campaign.status))
    .map((campaign) => ({
      id: campaign.id,
      label: campaignLabel(campaign.campaign, campaign.brand),
      ownBrand: invoice.brandId !== null && campaign.brandId === invoice.brandId,
    }))
    .sort((a, b) => Number(b.ownBrand) - Number(a.ownBrand) || a.label.localeCompare(b.label))
    .map(({ id, label }) => ({ id, label }));
}

export function lineItemTotal(item: InvoiceLineItemInput): number {
  return (Number(item.qty) || 0) * (Number(item.price) || 0);
}

export function computeSubtotal(items: InvoiceLineItemInput[]): number {
  return items.reduce((sum, item) => sum + lineItemTotal(item), 0);
}

export function computeBalanceDue(subtotal: number, advance: number): number {
  return Math.max(subtotal - (Number(advance) || 0), 0);
}

function daysBetween(startISO: string, endISO: string): number {
  const start = new Date(startISO).getTime();
  const end = new Date(endISO).getTime();
  return Math.round((end - start) / 86_400_000);
}

// The number just saved is already taken, so seeding the next invoice with
// it verbatim would immediately collide: bump it by one instead, keeping
// the zero-padded width (e.g. "0007" -> "0008"). Falls back to the literal
// value when it isn't numeric.
//
// Never moves the seed backwards: an invoice raised under a number the deal
// already quoted (see lib/campaignInvoice.ts) can sit below the seed, and
// seeding from it would hand the next invoice a number already in use.
function nextInvoiceNumberSeed(invoiceNo: string, currentSeed: string): string {
  const trimmed = invoiceNo.trim();
  const numeric = Number(trimmed);
  if (!trimmed || !Number.isFinite(numeric)) return trimmed;
  const current = Number(currentSeed.trim());
  if (Number.isFinite(current) && current > numeric + 1) return currentSeed;
  return String(numeric + 1).padStart(trimmed.length, "0");
}

// Builds the record to persist as the new defaults for the *next* invoice: 
// spreads `current` and overrides only the fields the form actually edits.
// qrImage/stampImage are safe to include here because InvoiceImageUploadField
// uploads to Vercel Blob and stores the resulting URL, not an inlined base64
// data URL: the same reason the media kit's image fields are safe to
// persist (see CHANGELOG 1.7.0, which moved media kit uploads to Blob for
// exactly this reason).
export function toInvoiceDefaults(state: InvoiceFormState, current: InvoiceData): InvoiceData {
  return {
    ...current,
    invoiceNumberSeed: nextInvoiceNumberSeed(state.invoiceNo, current.invoiceNumberSeed),
    campaignNameSeed: state.campaignName,
    dueInDays: Math.max(daysBetween(state.date, state.due), 0),
    billedToPlaceholder: {
      name: state.clientName || current.billedToPlaceholder.name,
      email: state.clientEmail || current.billedToPlaceholder.email,
    },
    defaultItems: state.items.map((item) => ({
      desc: item.desc,
      sub: item.sub,
      qty: item.qty,
      price: item.price,
    })),
    payee: {
      ...current.payee,
      name: state.payName,
      email: state.payEmail,
      paymentMode: state.paymentMode,
      upi: state.upi,
      bank: {
        accountName: state.bankAccountName,
        accountNumber: state.bankAccountNumber,
        ifsc: state.bankIfsc,
        bankName: state.bankName,
      },
      footerNote: state.gstNote,
      closingLine: state.closing,
      defaultQrImage: state.qrImage || current.payee.defaultQrImage,
      defaultStampImage: state.stampImage,
      // Persist new optional fields
      panNumber: state.panNumber.trim().toUpperCase(),
      address: state.address,
      instagram: state.instagramHandle,
      youtube: state.youtubeHandle,
      showInstagram: state.showInstagram ?? current.payee.showInstagram ?? false,
      showYouTube: state.showYouTube ?? current.payee.showYouTube ?? false,
    },
    barter: {
      defaultEnabled: state.barterOn,
      defaultValue: state.barterVal,
      defaultStatus: state.barterStatus,
    },
  };
}

interface InvoiceStatusStyle {
  variant: VariantProps<typeof badgeVariants>["variant"];
  className?: string;
}

// Same low-opacity palette-color convention as the workspace's transaction
// status badges (see EditEditorTransactionSheet): globals.css has no
// success/warning token, so meaning is carried by raw Tailwind colors.
export function invoiceStatusStyle(status: InvoiceDisplayStatus): InvoiceStatusStyle {
  switch (status) {
    case "partial":
      return {
        variant: "outline",
        className: "border-teal-500/30 bg-teal-500/10 text-teal-700 dark:bg-teal-500/15 dark:text-teal-400",
      };
    case "paid":
      return {
        variant: "outline",
        className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
      };
    case "sent":
      return {
        variant: "outline",
        className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
      };
    case "void":
      return { variant: "destructive" };
    default:
      return { variant: "secondary" };
  }
}

// A sent/draft invoice past its due date. Paid and void invoices are never
// overdue. `now` is injectable so callers can keep SSR deterministic.
export function isInvoiceOverdue(
  invoice: Pick<Invoice, "status" | "dueDate">,
  now: Date = new Date()
): boolean {
  if (invoice.status === "paid" || invoice.status === "void") return false;
  if (!invoice.dueDate) return false;
  return new Date(`${invoice.dueDate}T23:59:59`).getTime() < now.getTime();
}

export interface InvoiceStats {
  count: number;
  totalBilled: number;
  totalOutstanding: number;
  overdueCount: number;
}

// Void invoices are excluded everywhere: they never happened commercially,
// same convention as the earnings overview's handling of cancelled deals.
export function computeInvoiceStats(invoices: Invoice[], now: Date = new Date()): InvoiceStats {
  let count = 0;
  let totalBilled = 0;
  let totalOutstanding = 0;
  let overdueCount = 0;
  for (const invoice of invoices) {
    if (invoice.status === "void") continue;
    count += 1;
    // A draft hasn't been issued to the client yet: it's part of the
    // pipeline (count, overdue nudge) but no money has been billed or is owed.
    if (invoice.status !== "draft") {
      totalBilled += invoice.subtotal;
      if (invoice.status !== "paid") totalOutstanding += invoice.balanceDue;
    }
    if (isInvoiceOverdue(invoice, now)) overdueCount += 1;
  }
  return { count, totalBilled, totalOutstanding, overdueCount };
}

// --- List view: filtering, sorting, duplicate detection ---------------------
// Kept here (not in the client table component) so the list's business rules
// stay testable and out of the UI, per the project's architecture guide.

export type InvoiceFilter = "all" | "unpaid" | "draft" | "sent" | "paid" | "overdue";

export const INVOICE_FILTER_TABS: { value: InvoiceFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unpaid", label: "Unpaid" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
];

export function isInvoiceFilter(value: string | null | undefined): value is InvoiceFilter {
  return INVOICE_FILTER_TABS.some((tab) => tab.value === value);
}

// Every invoice number typed on more than one record: flag every copy so a
// clash is visible from the list without opening each one.
export function findDuplicateInvoiceNumbers(invoices: Pick<Invoice, "invoiceNo">[]): Set<string> {
  const counts = new Map<string, number>();
  for (const invoice of invoices) {
    const key = invoice.invoiceNo.trim();
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return new Set([...counts].filter(([, count]) => count > 1).map(([key]) => key));
}

function matchesInvoiceFilter(invoice: Invoice, filter: InvoiceFilter, now: Date): boolean {
  switch (filter) {
    case "all":
      return true;
    case "unpaid":
      return invoice.status !== "paid" && invoice.status !== "void";
    case "overdue":
      return isInvoiceOverdue(invoice, now);
    default:
      return invoice.status === filter;
  }
}

function matchesInvoiceQuery(invoice: Invoice, needle: string): boolean {
  if (!needle) return true;
  return (
    buildInvoiceNumber(invoice.invoiceNo).toLowerCase().includes(needle) ||
    invoice.campaignName.toLowerCase().includes(needle) ||
    invoice.client.name.toLowerCase().includes(needle) ||
    invoice.client.contactName.toLowerCase().includes(needle) ||
    invoice.client.email.toLowerCase().includes(needle)
  );
}

export function filterInvoices(
  invoices: Invoice[],
  { filter, query }: { filter: InvoiceFilter; query: string },
  now: Date = new Date()
): Invoice[] {
  const needle = query.trim().toLowerCase();
  return invoices.filter(
    (invoice) => matchesInvoiceFilter(invoice, filter, now) && matchesInvoiceQuery(invoice, needle)
  );
}

// Invoices are filed by financial year on their issue date: the date the
// bill is dated with, and the one a year's sales are counted by.

/** Every financial year an invoice was issued in, plus the current one, newest first. */
export function invoiceFinancialYears(
  invoices: Pick<Invoice, "issueDate">[],
  now: Date = new Date()
): number[] {
  return financialYearsPresent(
    invoices.map((invoice) => invoice.issueDate),
    now
  );
}

/**
 * The invoices issued in one financial year. A null year is the "All" view
 * and keeps every invoice, including any without a readable issue date,
 * which no single year can claim.
 */
export function invoicesInFinancialYear<T extends Pick<Invoice, "issueDate">>(
  invoices: T[],
  year: number | null
): T[] {
  if (year === null) return invoices;
  return invoices.filter((invoice) => isInFinancialYear(invoice.issueDate, year));
}

export type InvoiceSortColumn = "issueDate" | "dueDate" | "subtotal" | "balanceDue" | "status";
export type SortDirection = "asc" | "desc";

// Draft → Sent → Partly paid → Paid → Void: pipeline order, so ascending reads left-to-right.
const INVOICE_STATUS_ORDER: Record<InvoiceDisplayStatus, number> = { draft: 0, sent: 1, partial: 2, paid: 3, void: 4 };

export function sortInvoices(
  invoices: Invoice[],
  column: InvoiceSortColumn,
  direction: SortDirection
): Invoice[] {
  const factor = direction === "asc" ? 1 : -1;
  return [...invoices].sort((a, b) => {
    let delta: number;
    switch (column) {
      case "subtotal":
        delta = a.subtotal - b.subtotal;
        break;
      case "balanceDue":
        delta = a.balanceDue - b.balanceDue;
        break;
      case "status":
        delta = INVOICE_STATUS_ORDER[invoiceDisplayStatus(a)] - INVOICE_STATUS_ORDER[invoiceDisplayStatus(b)];
        break;
      case "dueDate":
        delta = a.dueDate.localeCompare(b.dueDate);
        break;
      default:
        delta = a.issueDate.localeCompare(b.issueDate);
    }
    // Stable tie-break so re-sorts don't reshuffle equal rows.
    if (delta === 0) delta = a.createdAt.localeCompare(b.createdAt);
    return factor * delta;
  });
}

// Deterministic (index-based) ids so an SSR render and the first client
// render agree: Math.random()/crypto here would cause a hydration mismatch.
function itemsWithStableIds(items: InvoiceLineItemInput[]): InvoiceLineItem[] {
  return items.map((item, index) => ({ ...item, id: `initial-${index}` }));
}

// Seeds the editor for a brand-new invoice from the saved defaults.
export function invoiceDefaultsToFormState(data: InvoiceData): InvoiceFormState {
  return {
    status: "draft",
    invoiceNo: data.invoiceNumberSeed,
    brandId: null,
    editorTransactionId: null,
    campaignName: data.campaignNameSeed,
    date: todayISO(),
    due: todayISO(data.dueInDays),
    clientName: "",
    clientContactName: "",
    clientEmail: "",
    clientAddress: "",
    clientPanNumber: "",
    clientGstNumber: "",
    items: itemsWithStableIds(data.defaultItems),
    barterOn: data.barter.defaultEnabled,
    barterVal: data.barter.defaultValue,
    barterStatus: data.barter.defaultStatus,
    payName: data.payee.name,
    payEmail: data.payee.email,
    paymentMode: data.payee.paymentMode,
    upi: data.payee.upi,
    bankAccountName: data.payee.bank.accountName,
    bankAccountNumber: data.payee.bank.accountNumber,
    bankIfsc: data.payee.bank.ifsc,
    bankName: data.payee.bank.bankName,
    gstNote: data.payee.footerNote,
    closing: data.payee.closingLine,
    qrImage: data.payee.defaultQrImage,
    stampImage: data.payee.defaultStampImage,
    // New optional fields
    panNumber: data.payee.panNumber || "",
    address: data.payee.address || "",
    instagramHandle: data.payee.instagram || "",
    youtubeHandle: data.payee.youtube || "",
    showInstagram: data.payee.showInstagram ?? false,
    showYouTube: data.payee.showYouTube ?? false,
  };
}

// Seeds the editor when opening a saved invoice for editing, or an unsaved one
// built from a record elsewhere (see lib/campaignInvoice.ts).
export function invoiceRecordToFormState(record: NewInvoice): InvoiceFormState {
  return {
    status: record.status,
    invoiceNo: record.invoiceNo,
    brandId: record.brandId ?? null,
    editorTransactionId: record.editorTransactionId ?? null,
    campaignName: record.campaignName ?? "",
    date: record.issueDate,
    due: record.dueDate,
    clientName: record.client.name,
    clientContactName: record.client.contactName,
    clientEmail: record.client.email,
    clientAddress: record.client.address || "",
    clientPanNumber: record.client.panNumber || "",
    clientGstNumber: record.client.gstNumber || "",
    items: itemsWithStableIds(record.items),
    barterOn: record.barter.enabled,
    barterVal: record.barter.value,
    barterStatus: record.barter.status,
    payName: record.payment.payeeName,
    payEmail: record.payment.payeeEmail,
    paymentMode: record.payment.mode,
    upi: record.payment.upi,
    bankAccountName: record.payment.bank.accountName,
    bankAccountNumber: record.payment.bank.accountNumber,
    bankIfsc: record.payment.bank.ifsc,
    bankName: record.payment.bank.bankName,
    gstNote: record.payment.footerNote,
    closing: record.payment.closingLine,
    qrImage: record.payment.qrImage,
    stampImage: record.payment.stampImage,
    // New optional fields
    panNumber: record.payment.panNumber || "",
    address: record.payment.address || "",
    instagramHandle: record.payment.instagram || "",
    youtubeHandle: record.payment.youtube || "",
    showInstagram: record.payment.showInstagram ?? false,
    showYouTube: record.payment.showYouTube ?? false,
  };
}

// Projects the editor's flat form state back into the nested shape the
// invoice repository persists.
export function formStateToInvoiceInput(state: InvoiceFormState): NewInvoice {
  return {
    status: state.status,
    invoiceNo: state.invoiceNo,
    brandId: state.brandId,
    editorTransactionId: state.editorTransactionId,
    campaignName: state.campaignName,
    issueDate: state.date,
    dueDate: state.due,
    client: {
      name: state.clientName,
      contactName: state.clientContactName,
      email: state.clientEmail,
      address: state.clientAddress,
      panNumber: state.clientPanNumber.trim().toUpperCase(),
      gstNumber: state.clientGstNumber,
    },
    items: state.items.map((item) => ({
      desc: item.desc,
      sub: item.sub,
      qty: item.qty,
      price: item.price,
    })),
    // Money received is recorded as payments, never typed on the invoice: the
    // writer keeps whatever advance an invoice already stores.
    advance: 0,
    barter: {
      enabled: state.barterOn,
      value: state.barterVal,
      status: state.barterStatus,
    },
    payment: {
      payeeName: state.payName,
      payeeEmail: state.payEmail,
      mode: state.paymentMode,
      upi: state.upi,
      bank: {
        accountName: state.bankAccountName,
        accountNumber: state.bankAccountNumber,
        ifsc: state.bankIfsc,
        bankName: state.bankName,
      },
      footerNote: state.gstNote,
      closingLine: state.closing,
      qrImage: state.qrImage,
      stampImage: state.stampImage,
      // New optional fields persisted on invoices
      panNumber: state.panNumber.trim().toUpperCase(),
      address: state.address || "",
      instagram: state.instagramHandle || "",
      youtube: state.youtubeHandle || "",
      showInstagram: state.showInstagram,
      showYouTube: state.showYouTube,
    },
  };
}

// --- CRM / workspace links -------------------------------------------------
// View-models for the editor's "link this invoice to …" pickers. Built on
// the server so the client editor only ever sees flat option lists, never
// the full Brand/Contact/EditorTransaction domain objects.

export interface InvoiceBrandOption {
  id: string;
  name: string;
  contactNames: string[]; // this brand's contacts (direct + agency), for prefilling "Billed to → Name"
}

export function buildInvoiceBrandOptions(brands: Brand[], contacts: Contact[]): InvoiceBrandOption[] {
  return [...brands]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((brand) => ({
      id: brand.id,
      name: brand.name,
      contactNames: contactsForBrand(brand, contacts).map((contact) => contact.name),
    }));
}

export interface InvoiceEditorJobOption {
  id: string;
  video: string;
  editor: string;
  amount: number | null;
  status: string;
}

/** The fields that decide whether an invoice holds an editor job. */
export type InvoiceEditorJobClaim = Pick<Invoice, "id" | "invoiceNo" | "status" | "editorTransactionId">;

/**
 * Whether an invoice holds the editor job it links to.
 *
 * A void invoice does not: it was withdrawn, and voiding one to reissue it is
 * exactly when the job has to move to the replacement. A draft does, since it
 * is on its way to being issued and a second draft for the same edit is the
 * duplicate this guards against. Truthiness rather than a null check, since a
 * record stored before the link existed has no such field at all.
 */
export function holdsEditorJob(invoice: Pick<Invoice, "status" | "editorTransactionId">): boolean {
  return Boolean(invoice.editorTransactionId) && invoice.status !== "void";
}

/**
 * The other invoice already holding an editor job, or null when it is free.
 *
 * One edit is one cost: linked to two invoices, its cost is netted off both
 * and the margin reads lower than it is. `exceptInvoiceId` is the invoice
 * being edited, which never blocks its own link.
 */
export function findEditorJobHolder<T extends InvoiceEditorJobClaim>(
  jobId: string | null,
  invoices: T[],
  exceptInvoiceId?: string | null
): T | null {
  if (!jobId) return null;
  return (
    invoices.find(
      (invoice) => invoice.id !== exceptInvoiceId && holdsEditorJob(invoice) && invoice.editorTransactionId === jobId
    ) ?? null
  );
}

/** The error a save shows when the job it links is held by another invoice. */
export function editorJobTakenMessage(holder: Pick<Invoice, "invoiceNo">): string {
  return `That editor job is already linked to ${buildInvoiceNumber(holder.invoiceNo)}. Unlink it there first.`;
}

// Most recent (by assigned date) first: the job a fresh invoice is most
// likely to bill for. Cancelled jobs are dropped: nothing to bill against.
//
// With `claims`, the list is for the editor's picker: jobs another invoice
// already holds are hidden, the same "linked once" rule the calendar and
// campaign video pickers follow (buildEditorVideoOptions). The invoice being
// edited keeps its own link visible even when legacy data shares it. Without
// `claims` every job is returned, which is what the margin lookups need: they
// resolve the job an invoice already links, whoever else links it.
export function buildInvoiceEditorJobOptions(
  transactions: EditorTransaction[],
  claims?: { invoices: InvoiceEditorJobClaim[]; currentInvoiceId?: string | null }
): InvoiceEditorJobOption[] {
  const ownLink = claims?.currentInvoiceId
    ? (claims.invoices.find((invoice) => invoice.id === claims.currentInvoiceId)?.editorTransactionId ?? null)
    : null;
  const heldElsewhere = new Set(
    (claims?.invoices ?? [])
      .filter((invoice) => invoice.id !== claims?.currentInvoiceId && holdsEditorJob(invoice))
      .map((invoice) => invoice.editorTransactionId)
  );

  return transactions
    .filter((txn) => txn.status.trim().toLowerCase() !== "cancelled")
    .filter((txn) => txn.id === ownLink || !heldElsewhere.has(txn.id))
    .slice()
    .sort((a, b) => {
      const delta = parseSheetDate(b.videoDate) - parseSheetDate(a.videoDate);
      return Number.isNaN(delta) ? 0 : delta;
    })
    .map((txn) => ({
      id: txn.id,
      video: txn.video,
      editor: txn.editor,
      amount: txn.amount,
      status: txn.status,
    }));
}

export interface InvoiceMargin {
  editorCost: number;
  margin: number; // invoice subtotal − editor cost
}

// Billed-vs-editor-cost for an invoice with a linked editing job. Returns
// null when nothing is linked so callers can render a dash instead of ₹0.
export function computeInvoiceMargin(
  invoice: Pick<Invoice, "subtotal" | "editorTransactionId">,
  jobs: InvoiceEditorJobOption[]
): InvoiceMargin | null {
  if (!invoice.editorTransactionId) return null;
  const job = jobs.find((entry) => entry.id === invoice.editorTransactionId);
  if (!job) return null;
  const editorCost = job.amount ?? 0;
  return { editorCost, margin: invoice.subtotal - editorCost };
}

export interface InvoiceMarginTotals {
  /** Issued invoices carrying a linked editing job: the only ones with a cost. */
  invoices: number;
  billed: number;
  editorCost: number;
  margin: number;
}

/**
 * Billed-vs-editor-cost across every invoice that has an editing job linked.
 *
 * computeInvoiceMargin answers this one invoice at a time, which is the right
 * shape for a table cell and the wrong one for "what is this actually worth
 * after the edit". `invoices` is carried so a surface can say how much of the
 * book the figure covers: an invoice with no job linked has no cost recorded,
 * not a cost of zero, and folding those in would read as pure margin.
 *
 * Drafts and void invoices are excluded, matching computeInvoiceStats: a
 * draft has not been issued, so nothing has been billed to net a cost off.
 *
 * Each editor job's cost is netted off once, however many invoices link it.
 * Saving refuses a second link now, but data saved before that rule can still
 * hold one job on two invoices (a deal and its renewal, say). Both still count
 * as billed; the edit was only paid for once.
 */
export function computeInvoiceMarginTotals(
  invoices: Invoice[],
  jobs: InvoiceEditorJobOption[]
): InvoiceMarginTotals {
  const totals: InvoiceMarginTotals = { invoices: 0, billed: 0, editorCost: 0, margin: 0 };
  const costed = new Set<string>();
  for (const invoice of invoices) {
    if (invoice.status === "void" || invoice.status === "draft") continue;
    const margin = computeInvoiceMargin(invoice, jobs);
    if (!margin || !invoice.editorTransactionId) continue;
    const editorCost = costed.has(invoice.editorTransactionId) ? 0 : margin.editorCost;
    costed.add(invoice.editorTransactionId);
    totals.invoices += 1;
    totals.billed += invoice.subtotal;
    totals.editorCost += editorCost;
  }
  totals.billed = roundMoney(totals.billed);
  totals.editorCost = roundMoney(totals.editorCost);
  totals.margin = roundMoney(totals.billed - totals.editorCost);
  return totals;
}

// Invoices belonging to a brand: an explicit brandId link, or, for invoices
// saved before the link existed / one-offs typed by hand: a case-insensitive
// match on the snapshotted client name.
export function invoicesForBrand(
  brand: Pick<Brand, "id" | "name">,
  invoices: Invoice[]
): Invoice[] {
  const key = normalizeBrandName(brand.name);
  return invoices.filter(
    (invoice) =>
      invoice.brandId === brand.id ||
      (!invoice.brandId && key.length > 0 && normalizeBrandName(invoice.client.name) === key)
  );
}
