import "server-only";
import {
  addCampaign,
  getCampaigns,
  setCampaignPaymentStatus,
  updateCampaign as writeCampaignUpdate,
} from "./campaigns.writer.server";
import type { Campaign, CampaignPaymentStatus, CampaignType } from "./campaigns";
import { toSheetDate } from "@/lib/campaigns";

export type { Campaign, CampaignPaymentStatus, CampaignType };

// Form-shaped input/update: dates as produced by <input type="date">
// ("yyyy-mm-dd"), converted to the storage format (DD/MM/YYYY) before being
// handed to campaigns.writer.server.ts. Distinct from NewCampaignInput/
// CampaignUpdate in ./campaigns, which are already storage-shaped.
export interface CampaignFormValues {
  brand: string;
  brandId: string | null;
  campaign: string;
  type: CampaignType;
  reels: string; // one of REEL_OPTIONS
  story: string; // one of STORY_OPTIONS
  status: string; // one of STATUS_OPTIONS
  amount: number;
  barterValue: number;
  paymentStatus: CampaignPaymentStatus;
  date: string; // "yyyy-mm-dd", as produced by <input type="date">
  uploadDate?: string; // "yyyy-mm-dd"
  invoiceId?: string;
  paymentDue?: string; // "yyyy-mm-dd"
  paymentMethod?: string;
  notes?: string;
}

export interface CampaignFormUpdate extends CampaignFormValues {
  id: string;
}

export interface ICampaignRepository {
  getAll(): Promise<Campaign[]>;
  create(input: CampaignFormValues): Promise<void>;
  update(input: CampaignFormUpdate): Promise<void>;
  // Marks the deal's payment as collected without touching any other field: 
  // the dashboard's quick action on a payments-due row.
  setPaymentReceived(campaignId: string): Promise<void>;
  // Reverts that: puts payment status back to "pending". Backs the Undo on
  // the "Mark received" toast.
  setPaymentPending(campaignId: string): Promise<void>;
}

class CampaignRepositoryImpl implements ICampaignRepository {
  async getAll(): Promise<Campaign[]> {
    return getCampaigns();
  }

  async create(input: CampaignFormValues): Promise<void> {
    await addCampaign({
      date: toSheetDate(input.date),
      brand: input.brand,
      brandId: input.brandId,
      campaign: input.campaign,
      type: input.type,
      reels: input.reels,
      story: input.story,
      status: input.status,
      amount: input.amount,
      barterValue: input.barterValue,
      paymentStatus: input.paymentStatus,
      uploadDate: input.uploadDate ? toSheetDate(input.uploadDate) : "",
      invoiceId: input.invoiceId,
      paymentDue: input.paymentDue ? toSheetDate(input.paymentDue) : "",
      paymentMethod: input.paymentMethod,
      notes: input.notes,
    });
  }

  async update(input: CampaignFormUpdate): Promise<void> {
    await writeCampaignUpdate({
      id: input.id,
      date: toSheetDate(input.date),
      brand: input.brand,
      brandId: input.brandId,
      campaign: input.campaign,
      type: input.type,
      reels: input.reels,
      story: input.story,
      status: input.status,
      amount: input.amount,
      barterValue: input.barterValue,
      paymentStatus: input.paymentStatus,
      uploadDate: input.uploadDate ? toSheetDate(input.uploadDate) : "",
      invoiceId: input.invoiceId,
      paymentDue: input.paymentDue ? toSheetDate(input.paymentDue) : "",
      paymentMethod: input.paymentMethod,
      notes: input.notes,
    });
  }

  async setPaymentReceived(campaignId: string): Promise<void> {
    await setCampaignPaymentStatus(campaignId, "received");
  }

  async setPaymentPending(campaignId: string): Promise<void> {
    await setCampaignPaymentStatus(campaignId, "pending");
  }
}

export const campaignRepository: ICampaignRepository = new CampaignRepositoryImpl();
