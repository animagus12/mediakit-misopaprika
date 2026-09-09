// Pipeline stage, not a payment/delivery state: mirrors Campaign's own
// status field being a separate axis in repositories/campaigns.ts.
export type BrandStatus =
  | "Lead"
  | "Contacted"
  | "Negotiating"
  | "Worked With"
  | "Active"
  | "Dormant"
  // The two ways a conversation ends before it is ever a deal, kept apart
  // because the record already tells them apart: "Passed" is a reply that was
  // a no, "Went Cold" is a reply that never came. Neither is "Cancelled",
  // which means a deal was agreed and then killed and which the fallthrough
  // rate in lib/dealFlow.ts counts on meaning exactly that.
  | "Passed"
  | "Went Cold"
  | "Cancelled"
  | "Do Not Contact";

export interface Brand {
  id: string;
  name: string; // linked from a Campaign via Campaign.brandId when set; case-insensitively matched as a fallback for older/unlinked campaigns, see lib/brandCampaignStats.ts
  logoUrl: string | null; // Vercel Blob URL
  website: string;
  instagram: string;
  agencyId: string | null; // → Agency; null when the brand deals directly, no agency in between
  primaryContactId: string | null; // → Contact; which of contactsForBrand() to surface on the brands table when there's more than one, null defers to the first on file
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
