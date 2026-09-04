import brandsJson from "@/data/brands.json";

// Pipeline stage, not a payment/delivery state — mirrors Campaign's own
// status field being a separate axis in repositories/campaigns.ts.
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
  name: string; // linked from a Campaign via Campaign.brandId when set; case-insensitively matched as a fallback for older/unlinked campaigns — see lib/brandCampaignStats.ts
  logoUrl: string | null; // Vercel Blob URL
  website: string;
  instagram: string;
  agencyId: string | null; // → Agency; null when the brand deals directly, no agency in between
  primaryContactId: string | null; // → Contact; which of contactsForBrand() to surface on the brands table when there's more than one — null defers to the first on file
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
  primaryContactId: string | null;
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
