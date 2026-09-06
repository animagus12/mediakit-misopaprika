import "server-only";
import { getCampaigns } from "./campaigns.writer.server";
import type { Campaign, CampaignPaymentStatus } from "./campaigns";

export type BrandCampaignPaymentStatus = CampaignPaymentStatus;

// One campaign, projected for the brand CRM's Campaigns/Payments tabs: same
// records repositories/collaborations.ts and repositories/earnings.ts read,
// just carrying the invoice/payment fields neither of those projections needs.
export interface BrandCampaignRecord {
  campaignId: string;
  brand: string;
  brandId: string | null; // → Brand (repositories/brands.ts); null when not linked to a CRM brand
  campaign: string;
  deliverables: string; // e.g. "1 Reel, 1 Story"
  date: string; // DD/MM/YYYY, deal date
  uploadDate: string; // DD/MM/YYYY, actual delivery date, often blank until posted
  status: string; // pipeline status: Discussion/Todo/Completed/Cancelled/...
  amount: number;
  barterValue: number;
  total: number;
  invoiceId: string;
  paymentStatus: BrandCampaignPaymentStatus;
  paymentDue: string; // DD/MM/YYYY the payment is expected by, or "" when unset
  paymentMethod: string;
  notes: string;
}

function toBrandCampaignRecord(campaign: Campaign): BrandCampaignRecord {
  return {
    campaignId: campaign.id,
    brand: campaign.brand,
    brandId: campaign.brandId,
    campaign: campaign.campaign,
    deliverables: [campaign.reels, campaign.story].filter(Boolean).join(", "),
    date: campaign.date,
    uploadDate: campaign.uploadDate,
    status: campaign.status,
    amount: campaign.amount,
    barterValue: campaign.barterValue,
    total: campaign.total,
    invoiceId: campaign.invoiceId,
    paymentStatus: campaign.paymentStatus,
    paymentDue: campaign.paymentDue,
    paymentMethod: campaign.paymentMethod,
    notes: campaign.notes,
  };
}

export async function fetchBrandCampaignRecords(): Promise<BrandCampaignRecord[]> {
  const campaigns = await getCampaigns();
  return campaigns.filter((c) => c.brand.trim()).map(toBrandCampaignRecord);
}
