import { computeEtaDays, toNonNegativeInt } from "@/lib/editorTransactions";
import { toPayer, toPaymentMethod, type Payer, type PaymentMethod } from "@/lib/payers";

// Shape as persisted (JSON seed / Redis): DD/MM/YYYY dates, no derived fields.
export interface EditorTransactionRecord {
  id: string;
  video: string;
  videoDate: string;
  deliveryDate: string;
  amount: number | null; // total owed, revisions included
  editor: string;
  status: string;
  // Optional: records written before revisions existed carry neither.
  revisions?: number;
  revisionRate?: number | null; // pinned when the first revision is charged
  // Optional: records written before payment details existed carry none.
  paidDate?: string; // DD/MM/YYYY like deliveryDate; "" unless status is Paid
  paidBy?: Payer;
  paymentMethod?: string;
}

export interface EditorTransaction extends EditorTransactionRecord {
  revisions: number;
  revisionRate: number | null;
  etaDays: number | null; // derived from videoDate/deliveryDate, see computeEtaDays
  paidDate: string;
  paymentMethod?: PaymentMethod;
}

export interface NewEditorTransaction {
  video: string;
  videoDate: string; // "yyyy-mm-dd", as produced by <input type="date">
  deliveryDate: string; // "yyyy-mm-dd", or "" while not yet delivered
  amount: number | null;
  editor: string;
  status: string;
  revisions: number;
  revisionRate: number | null;
  paidDate: string; // "yyyy-mm-dd", or "" when not recorded
  paidBy?: Payer;
  paymentMethod?: PaymentMethod;
}

export interface EditorTransactionUpdate extends NewEditorTransaction {
  id: string;
}

export function toEditorTransaction(record: EditorTransactionRecord): EditorTransaction {
  const revisions = toNonNegativeInt(record.revisions);
  return {
    ...record,
    revisions,
    revisionRate: revisions > 0 ? (record.revisionRate ?? null) : null,
    etaDays: computeEtaDays(record.videoDate, record.deliveryDate),
    paidDate: typeof record.paidDate === "string" ? record.paidDate.trim() : "",
    paidBy: toPayer(record.paidBy),
    paymentMethod: toPaymentMethod(record.paymentMethod),
  };
}
