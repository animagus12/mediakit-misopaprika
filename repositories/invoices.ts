import { computeBalanceDue, computeSubtotal } from "@/lib/invoice";
import { invoiceOwnSettlement } from "@/lib/payments";
import type { InvoiceBankDetails, InvoiceLineItemInput, InvoicePaymentMode } from "./invoice";
import type { PaymentTarget, Settlement } from "./payments";

// A saved invoice is a self-contained document. Unlike the invoice *defaults*
// (repositories/invoice.ts), which seed the next new invoice, each record
// carries its own copy of the payee/bank/branding block: snapshotted from
// the defaults when the invoice is first saved, then editable per invoice: 
// so changing the defaults later never rewrites past invoices.

export type InvoiceStatus = "draft" | "sent" | "paid" | "void";

export interface InvoiceClient {
  name: string;
  contactName: string;
  email: string;
  address?: string;
  panNumber?: string;
  gstNumber?: string;
}

export interface InvoiceBarter {
  enabled: boolean;
  value: number;
  status: string;
}

export interface InvoicePaymentSnapshot {
  payeeName: string;
  payeeEmail: string;
  mode: InvoicePaymentMode;
  upi: string;
  bank: InvoiceBankDetails;
  footerNote: string;
  closingLine: string;
  qrImage: string | null;
  stampImage: string | null;
  panNumber?: string;
  address?: string;
  instagram?: string;
  youtube?: string;
  showInstagram?: boolean;
  showYouTube?: boolean;
}

// Shape as persisted (JSON seed / Redis).
export interface InvoiceRecord {
  id: string;
  status: InvoiceStatus;
  invoiceNo: string; // stored literally as typed, e.g. "0007": see lib/invoice.ts's buildInvoiceNumber
  brandId: string | null; // → Brand (repositories/brands.ts); null for a one-off not tied to a CRM brand. client.name stays the snapshot shown on the invoice.
  editorTransactionId: string | null; // → EditorTransaction (repositories/editorTransactions.ts); null when no editing job is linked. Used to show billed-vs-editor-cost margin.
  campaignName: string; // the brand campaign this invoice bills for
  issueDate: string; // yyyy-mm-dd, as produced by <input type="date">
  dueDate: string; // yyyy-mm-dd
  client: InvoiceClient;
  items: InvoiceLineItemInput[];
  advance: number;
  barter: InvoiceBarter;
  payment: InvoicePaymentSnapshot;
  createdAt: string; // ISO datetime
  updatedAt: string;
}

export interface Invoice extends InvoiceRecord {
  subtotal: number; // derived from items, never stored, so it can't drift
  balanceDue: number; // subtotal - advance, floored at 0
  /** The status as stored, before the ledger projects `status` from payments. */
  storedStatus: InvoiceStatus;
  /** The deal or renewal whose invoiceId points here; null for a standalone invoice. */
  owner: PaymentTarget | null;
  /** The owner's settlement when linked, the invoice's own when standalone. */
  settlement: Settlement;
}

/** An invoice's status as a list shows it: "partial" once part of what it bills has arrived. */
export type InvoiceDisplayStatus = InvoiceStatus | "partial";

export interface NewInvoice {
  status: InvoiceStatus;
  invoiceNo: string;
  brandId: string | null;
  editorTransactionId: string | null;
  campaignName: string;
  issueDate: string;
  dueDate: string;
  client: InvoiceClient;
  items: InvoiceLineItemInput[];
  advance: number;
  barter: InvoiceBarter;
  payment: InvoicePaymentSnapshot;
}

export interface InvoiceUpdate extends NewInvoice {
  id: string;
}

// Settled as standalone from its own fields: the owner and any stored
// payments are joined later (attachInvoiceSettlements in lib/payments.ts),
// which needs the deals and the ledger alongside.
export function toInvoice(record: InvoiceRecord): Invoice {
  const subtotal = computeSubtotal(record.items);
  return {
    ...record,
    subtotal,
    balanceDue: computeBalanceDue(subtotal, record.advance),
    storedStatus: record.status,
    owner: null,
    settlement: invoiceOwnSettlement(record, []),
  };
}
