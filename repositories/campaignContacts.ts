import campaignContactsJson from "@/data/campaign-contacts.json";

// Sheet-linked campaigns are read-only (see repositories/brandCampaigns.ts),
// so "which contact handled this deal" can't live on the sheet row itself —
// this is a separate local assignment keyed by the sheet's Campaign ID.
// One contact per campaign; campaignId is the natural unique key.
export interface CampaignContact {
  campaignId: string;
  brandId: string; // scopes revalidation + brand-deletion cascade
  contactId: string;
  updatedAt: string; // ISO datetime
}

export interface ICampaignContactRepository {
  get(): CampaignContact[];
}

class JsonCampaignContactRepository implements ICampaignContactRepository {
  get(): CampaignContact[] {
    return campaignContactsJson as CampaignContact[];
  }
}

export const campaignContactRepository: ICampaignContactRepository = new JsonCampaignContactRepository();
