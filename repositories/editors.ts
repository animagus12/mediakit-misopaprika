export interface Editor {
  id: string;
  name: string;
  phone: string;
  email: string;
  upi: string;
  qrImage: string | null; // Vercel Blob URL, see app/api/workspace/upload
  revisionRate: number; // ₹ per revision, added onto a transaction's amount
}

export interface NewEditor {
  name: string;
  phone: string;
  email: string;
  upi: string;
  qrImage: string | null;
  revisionRate: number;
}

export interface EditorUpdate extends NewEditor {
  id: string;
}
