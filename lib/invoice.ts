import type { VariantProps } from "class-variance-authority";
import type { badgeVariants } from "@/components/ui/badge";
import type { InvoiceFormState } from "@/components/invoice/types";
import type { InvoiceData, InvoiceLineItemInput } from "@/repositories/invoice";
import type { Invoice, InvoiceRecord, InvoiceStatus, NewInvoice } from "@/repositories/invoices";
import type { Brand } from "@/repositories/brands";
import type { Contact } from "@/repositories/contacts";
import type { EditorTransaction } from "@/repositories/editorTransactions";
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

export function buildInvoiceNumber(invoiceNo: string): string {
  return `MSP-INV-${String(invoiceNo || "").trim().padStart(4, "0")}`;
}

/**
 * Resolves a campaign's free-text `invoiceId` ("MSP-INV-0008") to the invoice
 * record it names. Campaign.invoiceId is a reference typed on the campaign
 * form, not a foreign key, so the match goes through buildInvoiceNumber():
 * the same function that renders an invoice's number, which is what makes the
 * two sides line up. Returns null when the reference is blank or names an
 * invoice that was never saved as a record.
 */
export function findInvoiceByCampaignRef<T extends { invoiceNo: string }>(
  invoiceRef: string,
  invoices: T[]
): T | null {
  const ref = invoiceRef.trim().toUpperCase();
  if (!ref || ref === "-") return null;
  return invoices.find((invoice) => buildInvoiceNumber(invoice.invoiceNo).toUpperCase() === ref) ?? null;
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
function nextInvoiceNumberSeed(invoiceNo: string): string {
  const trimmed = invoiceNo.trim();
  const numeric = Number(trimmed);
  if (!trimmed || !Number.isFinite(numeric)) return trimmed;
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
    invoiceNumberSeed: nextInvoiceNumberSeed(state.invoiceNo),
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

// Seeds the editor when opening a saved invoice for editing.
export function invoiceRecordToFormState(record: InvoiceRecord): InvoiceFormState {
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

// Resolves a campaign record's free-text "Invoice ID" field to a saved
// invoice record. The field is entered by hand and inconsistent: 
// "MSP-INV-0007", "0007", "7" all mean the same invoice: so match on the
// full label, the raw number, and the zero-stripped number.
export function findInvoiceByCampaignInvoiceId(campaignInvoiceId: string, invoices: Invoice[]): Invoice | undefined {
  const needle = campaignInvoiceId.trim().toLowerCase();
  if (!needle) return undefined;
  return invoices.find((invoice) => {
    const no = invoice.invoiceNo.trim().toLowerCase();
    if (!no) return false;
    return (
      needle === no ||
      needle === no.replace(/^0+/, "") ||
      needle === buildInvoiceNumber(invoice.invoiceNo).toLowerCase()
    );
  });
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
