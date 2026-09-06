// Brand-facing campaign records are read-only (see repositories/brandCampaigns.ts),
// so "which contact handled this deal" can't live on the campaign record
// itself: this is a separate local assignment keyed by the campaign's ID.
// One contact per campaign; campaignId is the natural unique key.
export interface CampaignContact {
  campaignId: string;
  brandId: string; // scopes revalidation + brand-deletion cascade
  contactId: string;
  updatedAt: string; // ISO datetime
}
