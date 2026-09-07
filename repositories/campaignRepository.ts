import "server-only";
import {
  addCampaign,
  getCampaigns,
  setCampaignPaymentStatus,
  updateCampaign as writeCampaignUpdate,
} from "./campaigns.writer.server";
import type { Campaign, CampaignPaymentStatus, CampaignRecord, CampaignType } from "./campaigns";
import { toSheetDate } from "@/lib/campaigns";
import type { RecordChange } from "@/lib/activityDiff";

export type { Campaign, CampaignPaymentStatus, CampaignRecord, CampaignType };

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
  // Answers the record it wrote, whose id is generated during the write
  // (see nextCampaignId): the caller has no other way to learn it.
  create(input: CampaignFormValues): Promise<CampaignRecord>;
  // Answers the record either side of the write (null when the id matched
  // nothing), so a caller can report what changed.
  update(input: CampaignFormUpdate): Promise<RecordChange<CampaignRecord> | null>;
  // Marks the deal's payment as collected without touching any other field: 
  // the dashboard's quick action on a payments-due row.
  setPaymentReceived(campaignId: string): Promise<CampaignRecord>;
  // Reverts that: puts payment status back to "pending". Backs the Undo on
  // the "Mark received" toast.
  setPaymentPending(campaignId: string): Promise<CampaignRecord>;
}

class CampaignRepositoryImpl implements ICampaignRepository {
  async getAll(): Promise<Campaign[]> {
    return getCampaigns();
  }

  async create(input: CampaignFormValues): Promise<CampaignRecord> {
    return addCampaign({
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

  async update(input: CampaignFormUpdate): Promise<RecordChange<CampaignRecord> | null> {
    return writeCampaignUpdate({
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

  async setPaymentReceived(campaignId: string): Promise<CampaignRecord> {
    return setCampaignPaymentStatus(campaignId, "received");
  }

  async setPaymentPending(campaignId: string): Promise<CampaignRecord> {
    return setCampaignPaymentStatus(campaignId, "pending");
  }
}

export const campaignRepository: ICampaignRepository = new CampaignRepositoryImpl();
