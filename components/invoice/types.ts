import type { InvoiceLineItem } from "@/lib/invoice";
import type { InvoicePaymentMode } from "@/repositories/invoice";
import type { InvoiceStatus } from "@/repositories/invoices";

export interface InvoiceFormState {
  status: InvoiceStatus;
  invoiceNo: string;
  brandId: string | null;
  editorTransactionId: string | null;
  campaignName: string;
  date: string;
  due: string;
  clientName: string;
  clientContactName: string;
  clientEmail: string;
  items: InvoiceLineItem[];
  advance: number;
  barterOn: boolean;
  barterVal: number;
  barterStatus: string;
  payName: string;
  payEmail: string;
  paymentMode: InvoicePaymentMode;
  upi: string;
  bankAccountName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  bankName: string;
  gstNote: string;
  closing: string;
  qrImage: string | null;
  stampImage: string | null;
}

export interface InvoiceFormActions {
  setField: <K extends keyof InvoiceFormState>(field: K, value: InvoiceFormState[K]) => void;
  selectBrand: (brandId: string | null) => void;
  selectEditorJob: (editorTransactionId: string | null) => void;
  updateItem: (id: string, field: "desc" | "sub" | "qty" | "price", value: string) => void;
  removeItem: (id: string) => void;
  addItem: () => void;
  applyPreset: (presetId: string) => void;
  reset: () => void;
  save: () => void;
  download: () => void;
  setQrImage: (dataUrl: string | null) => void;
  setStampImage: (dataUrl: string | null) => void;
}
