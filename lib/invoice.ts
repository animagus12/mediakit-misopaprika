import type { InvoiceFormState } from "@/components/invoice/types";
import type { InvoiceData, InvoiceLineItemInput } from "@/repositories/invoice";

export interface InvoiceLineItem extends InvoiceLineItemInput {
  id: string;
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
