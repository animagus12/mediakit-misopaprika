import invoicesJson from "@/data/invoices.json";
import { computeBalanceDue, computeSubtotal } from "@/lib/invoice";
import type { InvoiceBankDetails, InvoiceLineItemInput, InvoicePaymentMode } from "./invoice";

// A saved invoice is a self-contained document. Unlike the invoice *defaults*
// (repositories/invoice.ts), which seed the next new invoice, each record
// carries its own copy of the payee/bank/branding block — snapshotted from
// the defaults when the invoice is first saved, then editable per invoice —
// so changing the defaults later never rewrites past invoices.

export type InvoiceStatus = "draft" | "sent" | "paid" | "void";

export interface InvoiceClient {
  name: string;
  contactName: string;
  email: string;
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
}

// Shape as persisted (JSON seed / Redis).
export interface InvoiceRecord {
  id: string;
  status: InvoiceStatus;
  invoiceNo: string; // stored literally as typed, e.g. "0007" — see lib/invoice.ts's buildInvoiceNumber
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
  subtotal: number; // derived from items — never stored, so it can't drift
  balanceDue: number; // subtotal - advance, floored at 0
}

export interface NewInvoice {
  status: InvoiceStatus;
  invoiceNo: string;
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

export function toInvoice(record: InvoiceRecord): Invoice {
  const subtotal = computeSubtotal(record.items);
  return { ...record, subtotal, balanceDue: computeBalanceDue(subtotal, record.advance) };
}

export interface IInvoiceRecordRepository {
  get(): Invoice[];
}

class JsonInvoiceRecordRepository implements IInvoiceRecordRepository {
  get(): Invoice[] {
    return (invoicesJson as InvoiceRecord[]).map(toInvoice);
  }
}

export const invoiceRecordRepository: IInvoiceRecordRepository = new JsonInvoiceRecordRepository();
