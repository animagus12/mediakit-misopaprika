import editorsJson from "@/data/editors.json";

export interface Editor {
  id: string;
  name: string;
  phone: string;
  email: string;
  upi: string;
  qrImage: string | null; // Vercel Blob URL — see app/api/workspace/upload
}

export interface NewEditor {
  name: string;
  phone: string;
  email: string;
  upi: string;
  qrImage: string | null;
}

export interface EditorUpdate extends NewEditor {
  id: string;
}

export interface IEditorRepository {
  get(): Editor[];
}

class JsonEditorRepository implements IEditorRepository {
  get(): Editor[] {
    return editorsJson as Editor[];
  }
}

export const editorRepository: IEditorRepository = new JsonEditorRepository();
