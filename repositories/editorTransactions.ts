import { computeEtaDays, toNonNegativeInt } from "@/lib/editorTransactions";

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
}

export interface EditorTransaction extends EditorTransactionRecord {
  revisions: number;
  revisionRate: number | null;
  etaDays: number | null; // derived from videoDate/deliveryDate, see computeEtaDays
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
  };
}
