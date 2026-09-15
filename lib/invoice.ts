import type { VariantProps } from "class-variance-authority";
import type { badgeVariants } from "@/components/ui/badge";
import type { InvoiceFormState } from "@/components/invoice/types";
import type { InvoiceData, InvoiceLineItemInput } from "@/repositories/invoice";
import type { Invoice, InvoiceStatus, NewInvoice } from "@/repositories/invoices";
import type { Brand } from "@/repositories/brands";
import type { Campaign, CampaignPaymentStatus, CampaignStatus } from "@/repositories/campaigns";
import type { Contact } from "@/repositories/contacts";
import type { EditorTransaction } from "@/repositories/editorTransactions";
import { isCampaignCalledOff } from "./campaigns";
import { contactsForBrand } from "./contacts";
import { parseSheetDate } from "./editorTransactions";
import { normalizeBrandName } from "./brandCampaignStats";

export interface InvoiceLineItem extends InvoiceLineItemInput {
  id: string;
}

// Kept client-safe (no "server-only") since the editor renders these as
// <Select> options: mirrors lib/editorTransactions.ts's status options.
export const INVOICE_STATUS_OPTIONS: InvoiceStatus[] = ["draft", "sent", "paid", "void"];

export function formatInvoiceStatus(status: InvoiceStatus): string {
  return status[0].toUpperCase() + status.slice(1);
}

export function formatMoney(amount: number): string {
  return `₹ ${Number(amount || 0).toLocaleString("en-IN")}`;
}

export function formatInvoiceDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export function todayISO(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
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
  invoices: Pick<Invoice, "id" | "invoiceNo" | "campaignName" | "client">[],
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
      };
    })
    .sort((a, b) => b.number.localeCompare(a.number, undefined, { numeric: true }));
}

/**
 * The payment status a deal moves to when the invoice billing it is marked
 * `invoiceStatus`, or null to leave the deal alone.
 *
 * Sent means the money is owed and paid means it arrived, whatever the deal
 * said before, "Not tracked" included: raising and sending the invoice is the
 * tracking. A called-off deal is owed nothing, so an invoice cannot put a
 * payment back on it; drafts and void invoices say nothing about money.
 */
export function paymentStatusForInvoice(
  campaign: { status: CampaignStatus; paymentStatus: CampaignPaymentStatus },
  invoiceStatus: InvoiceStatus
): CampaignPaymentStatus | null {
  if (invoiceStatus !== "paid" && invoiceStatus !== "sent") return null;
  if (isCampaignCalledOff(campaign.status)) return null;
  const target = invoiceStatus === "paid" ? "received" : "pending";
  return campaign.paymentStatus === target ? null : target;
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
export function invoiceStatusStyle(status: InvoiceStatus): InvoiceStatusStyle {
  switch (status) {
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

export type InvoiceSortColumn = "issueDate" | "dueDate" | "subtotal" | "balanceDue" | "status";
export type SortDirection = "asc" | "desc";

// Draft → Sent → Paid → Void: pipeline order, so ascending reads left-to-right.
const INVOICE_STATUS_ORDER: Record<InvoiceStatus, number> = { draft: 0, sent: 1, paid: 2, void: 3 };

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
        delta = INVOICE_STATUS_ORDER[a.status] - INVOICE_STATUS_ORDER[b.status];
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
    items: itemsWithStableIds(data.defaultItems),
    advance: 0,
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
    items: itemsWithStableIds(record.items),
    advance: record.advance,
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
    },
    items: state.items.map((item) => ({
      desc: item.desc,
      sub: item.sub,
      qty: item.qty,
      price: item.price,
    })),
    advance: state.advance,
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

// Most recent (by assigned date) first: the job a fresh invoice is most
// likely to bill for. Cancelled jobs are dropped: nothing to bill against.
export function buildInvoiceEditorJobOptions(transactions: EditorTransaction[]): InvoiceEditorJobOption[] {
  return transactions
    .filter((txn) => txn.status.trim().toLowerCase() !== "cancelled")
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
 */
export function computeInvoiceMarginTotals(
  invoices: Invoice[],
  jobs: InvoiceEditorJobOption[]
): InvoiceMarginTotals {
  const totals: InvoiceMarginTotals = { invoices: 0, billed: 0, editorCost: 0, margin: 0 };
  for (const invoice of invoices) {
    if (invoice.status === "void" || invoice.status === "draft") continue;
    const margin = computeInvoiceMargin(invoice, jobs);
    if (!margin) continue;
    totals.invoices += 1;
    totals.billed += invoice.subtotal;
    totals.editorCost += margin.editorCost;
    totals.margin += margin.margin;
  }
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

// A one-line note when the campaign record's payment status and the saved
// invoice's status disagree, so the mismatch is visible without opening
// both. null when they're consistent (or too loosely related to compare).
export function invoicePaymentMismatch(
  campaignPaymentStatus: "received" | "pending" | "unknown",
  invoiceStatus: InvoiceStatus
): string | null {
  if (campaignPaymentStatus === "received" && invoiceStatus !== "paid" && invoiceStatus !== "void") {
    return "Campaign says received: invoice isn't marked paid";
  }
  if (campaignPaymentStatus === "pending" && invoiceStatus === "paid") {
    return "Invoice marked paid: campaign still says pending";
  }
  return null;
}
