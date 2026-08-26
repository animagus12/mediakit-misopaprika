import brandNotesJson from "@/data/brand-notes.json";

export interface BrandNote {
  id: string;
  brandId: string;
  body: string;
  createdAt: string; // ISO datetime
}

export interface NewBrandNote {
  brandId: string;
  body: string;
}

export interface IBrandNoteRepository {
  get(): BrandNote[];
}

class JsonBrandNoteRepository implements IBrandNoteRepository {
  get(): BrandNote[] {
    return brandNotesJson as BrandNote[];
  }
}

export const brandNoteRepository: IBrandNoteRepository = new JsonBrandNoteRepository();
