import brandsJson from "@/data/brands.json";

// Pipeline stage, not a payment/delivery state — mirrors the sheet's own
// Status column being a separate axis in repositories/collaborations.ts.
export type BrandStatus =
  | "Lead"
  | "Contacted"
  | "Negotiating"
  | "Worked With"
  | "Active"
  | "Dormant"
  | "Cancelled"
  | "Do Not Contact";

export interface Brand {
  id: string;
  name: string; // matched (case-insensitively) against the Campaigns sheet's Brand column — see lib/brandCampaignStats.ts
  logoUrl: string | null; // Vercel Blob URL
  website: string;
  instagram: string;
  agencyId: string | null; // → Agency; null when the brand deals directly, no agency in between
  status: BrandStatus;
  createdAt: string; // ISO datetime
  updatedAt: string;
}

export interface NewBrand {
  name: string;
  logoUrl: string | null;
  website: string;
  instagram: string;
  agencyId: string | null;
  status: BrandStatus;
}

export interface BrandUpdate extends NewBrand {
  id: string;
}

export interface IBrandRepository {
  get(): Brand[];
}

class JsonBrandRepository implements IBrandRepository {
  get(): Brand[] {
    return brandsJson as Brand[];
  }
}

export const brandRepository: IBrandRepository = new JsonBrandRepository();
