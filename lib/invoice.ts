import type { VariantProps } from "class-variance-authority";
import type { badgeVariants } from "@/components/ui/badge";
import type { InvoiceFormState } from "@/components/invoice/types";
import type { InvoiceData, InvoiceLineItemInput } from "@/repositories/invoice";
import type { Invoice, InvoiceRecord, InvoiceStatus, NewInvoice } from "@/repositories/invoices";

export interface InvoiceLineItem extends InvoiceLineItemInput {
  id: string;
}

// Kept client-safe (no "server-only") since the editor renders these as
// <Select> options — mirrors lib/editorTransactions.ts's status options.
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

export function lineItemTotal(item: InvoiceLineItemInput): number {
  return (Number(item.qty) || 0) * (Number(item.price) || 0);
}

export function computeSubtotal(items: InvoiceLineItemInput[]): number {
  return items.reduce((sum, item) => sum + lineItemTotal(item), 0);
}

export function computeBalanceDue(subtotal: number, advance: number): number {
  return Math.max(subtotal - (Number(advance) || 0), 0);
}

export function daysBetween(startISO: string, endISO: string): number {
  const start = new Date(startISO).getTime();
  const end = new Date(endISO).getTime();
  return Math.round((end - start) / 86_400_000);
}

// Builds the record to persist as the new defaults for the *next* invoice —
// spreads `current` and overrides only the fields the form actually edits.
// qrImage/stampImage are safe to include here because InvoiceImageUploadField
// uploads to Vercel Blob and stores the resulting URL, not an inlined base64
// data URL — the same reason the media kit's image fields are safe to
// persist (see CHANGELOG 1.7.0, which moved media kit uploads to Blob for
// exactly this reason).
export function toInvoiceDefaults(state: InvoiceFormState, current: InvoiceData): InvoiceData {
  return {
    ...current,
    invoiceNumberSeed: state.invoiceNo,
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
// status badges (see EditEditorTransactionSheet) — globals.css has no
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

// Void invoices are excluded everywhere — they never happened commercially,
// same convention as the earnings overview's handling of cancelled deals.
export function computeInvoiceStats(invoices: Invoice[], now: Date = new Date()): InvoiceStats {
  let count = 0;
  let totalBilled = 0;
  let totalOutstanding = 0;
  let overdueCount = 0;
  for (const invoice of invoices) {
    if (invoice.status === "void") continue;
    count += 1;
    totalBilled += invoice.subtotal;
    if (invoice.status !== "paid") totalOutstanding += invoice.balanceDue;
    if (isInvoiceOverdue(invoice, now)) overdueCount += 1;
  }
  return { count, totalBilled, totalOutstanding, overdueCount };
}

// Deterministic (index-based) ids so an SSR render and the first client
// render agree — Math.random()/crypto here would cause a hydration mismatch.
function itemsWithStableIds(items: InvoiceLineItemInput[]): InvoiceLineItem[] {
  return items.map((item, index) => ({ ...item, id: `initial-${index}` }));
}

// Seeds the editor for a brand-new invoice from the saved defaults.
export function invoiceDefaultsToFormState(data: InvoiceData): InvoiceFormState {
  return {
    status: "draft",
    invoiceNo: data.invoiceNumberSeed,
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
