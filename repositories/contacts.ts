// A contact hangs off exactly one of brandId/agencyId. An agency contact
// (e.g. IPLIX's Rajveer) surfaces on every brand that agency reps, without
// re-entering the same person per brand: see Brand.agencyId.
export interface Contact {
  id: string;
  name: string;
  phone: string;
  brandId: string | null;
  agencyId: string | null;
  createdAt: string; // ISO datetime
  updatedAt: string;
}

export interface NewContact {
  name: string;
  phone: string;
  brandId: string | null;
  agencyId: string | null;
}

export interface ContactUpdate extends NewContact {
  id: string;
}
