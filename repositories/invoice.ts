import invoiceJson from "@/data/invoice.json";

export interface InvoiceLineItemInput {
  desc: string;
  sub: string;
  qty: number;
  price: number;
}

export interface InvoicePreset {
  id: string;
  label: string;
  items: InvoiceLineItemInput[];
}

export interface InvoiceContact {
  name: string;
  email: string;
}

export type InvoicePaymentMode = "upi" | "bank" | "both";

export interface InvoiceBankDetails {
  accountName: string;
  accountNumber: string;
  ifsc: string;
  bankName: string;
}

export interface InvoicePayee {
  name: string;
  email: string;
  upi: string;
  bank: InvoiceBankDetails;
  paymentMode: InvoicePaymentMode;
  footerNote: string;
  closingLine: string;
  defaultQrImage: string;
  defaultStampImage: string | null;
}

export interface InvoiceBarterDefaults {
  defaultEnabled: boolean;
  defaultValue: number;
  defaultStatus: string;
}

export interface InvoiceData {
  brandHandle: string;
  invoiceNumberSeed: string;
  dueInDays: number;
  billedToPlaceholder: InvoiceContact;
  defaultItems: InvoiceLineItemInput[];
  presets: InvoicePreset[];
  payee: InvoicePayee;
  barter: InvoiceBarterDefaults;
}

export interface IInvoiceRepository {
  get(): InvoiceData;
}

class JsonInvoiceRepository implements IInvoiceRepository {
  get(): InvoiceData {
    return invoiceJson as InvoiceData;
  }
}

export const invoiceRepository: IInvoiceRepository = new JsonInvoiceRepository();
