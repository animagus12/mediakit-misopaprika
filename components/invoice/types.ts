import type { InvoiceLineItem } from "@/lib/invoice";

export interface InvoiceFormState {
  invoiceNo: string;
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
  upi: string;
  gstNote: string;
  closing: string;
  qrImage: string | null;
  stampImage: string | null;
}

export interface InvoiceFormActions {
  setField: <K extends keyof InvoiceFormState>(field: K, value: InvoiceFormState[K]) => void;
  updateItem: (id: string, field: "desc" | "sub" | "qty" | "price", value: string) => void;
  removeItem: (id: string) => void;
  addItem: () => void;
  applyPreset: (presetId: string) => void;
  reset: () => void;
  print: () => void;
  setQrImage: (dataUrl: string | null) => void;
  setStampImage: (dataUrl: string | null) => void;
}
