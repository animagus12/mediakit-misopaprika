import editorTransactionsJson from "@/data/editor-transactions.json";
import { computeEtaDays } from "@/lib/editorTransactions";

// Shape as persisted (JSON seed / Redis) — DD/MM/YYYY dates, no derived fields.
export interface EditorTransactionRecord {
  id: string;
  video: string;
  videoDate: string;
  deliveryDate: string;
  amount: number | null;
  editor: string;
  status: string;
}

export interface EditorTransaction extends EditorTransactionRecord {
  etaDays: number; // derived from videoDate/deliveryDate — see computeEtaDays
}

export interface NewEditorTransaction {
  video: string;
  videoDate: string; // "yyyy-mm-dd", as produced by <input type="date">
  deliveryDate: string; // "yyyy-mm-dd"
  amount: number | null;
  editor: string;
  status: string;
}

export interface EditorTransactionUpdate extends NewEditorTransaction {
  id: string;
}

export function toEditorTransaction(record: EditorTransactionRecord): EditorTransaction {
  return { ...record, etaDays: computeEtaDays(record.videoDate, record.deliveryDate) };
}

export interface IEditorTransactionRepository {
  get(): EditorTransaction[];
}

class JsonEditorTransactionRepository implements IEditorTransactionRepository {
  get(): EditorTransaction[] {
    return (editorTransactionsJson as EditorTransactionRecord[]).map(toEditorTransaction);
  }
}

export const editorTransactionRepository: IEditorTransactionRepository = new JsonEditorTransactionRepository();
