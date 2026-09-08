import "server-only";
import {
  addCampaign,
  addCampaignUsageRenewal,
  getCampaigns,
  setCampaignInvoice,
  setCampaignPaymentStatus,
  setCampaignUploadDate,
  setUsageRenewalInvoice,
  setUsageRenewalPayment,
  transitionCampaignUsage,
  updateCampaign as writeCampaignUpdate,
} from "./campaigns.writer.server";
import type { UsageTransition } from "./campaigns.writer.server";
import type { Campaign, CampaignPaymentStatus, CampaignRecord, CampaignType } from "./campaigns";
import { toSheetDate } from "@/lib/campaigns";
import { todayKey } from "@/lib/day";
import type { RecordChange } from "@/lib/activityDiff";

export type { Campaign, CampaignPaymentStatus, CampaignRecord, CampaignType };
export type { UsageTransition };

// The creator's civil day, in the format the store keeps dates in. Every
// "stamp this with today" write goes through here rather than reading the
// server clock in the writer: rendering happens on a UTC host, so a payment
// collected at 10am IST would otherwise be filed under the previous day for
// the first five and a half hours of every one. lib/day.ts pins the zone.
function today(): string {
  return toSheetDate(todayKey());
}

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
  invoiceRef?: string; // free-text invoice reference; the invoiceId foreign key is never form-settable
  paymentDue?: string; // "yyyy-mm-dd"
  paidDate?: string; // "yyyy-mm-dd", the day the money actually landed
  paymentMethod?: string;
  editorTransactionId?: string | null; // the editing job behind the video, or null
  usageMonths?: number; // base ad-usage licence term; 0 or absent = not tracked
}

export interface CampaignFormUpdate extends CampaignFormValues {
  id: string;
}

/**
 * Form-shaped renewal input, as the renew dialog produces it.
 *
 * Its own type rather than a partial CampaignFormValues: a renewal shares the
 * payment vocabulary with a deal and nothing else, and the two are written to
 * different places.
 */
export interface UsageRenewalFormValues {
  startDate: string; // "yyyy-mm-dd", the day the extended term runs from
  months: number;
  amount: number;
  paymentStatus: CampaignPaymentStatus;
  paymentDue: string; // "yyyy-mm-dd"
  paidDate: string; // "yyyy-mm-dd"
  paymentMethod: string;
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
  // Sets the deal's posting day, or clears it back off with "": the content
  // calendar's inline scheduler, which moves that one field rather than
  // resaving a whole form. Answers the record either side of the write (null
  // when the id matched nothing) so the caller can report what it moved from.
  schedulePost(campaignId: string, isoDate: string): Promise<RecordChange<CampaignRecord> | null>;
  // The three answers to "this licence is about to run out": freeze it,
  // restart a frozen one, or call it off. Each writes only the licence, and
  // each answers the record either side so the caller can say what moved.
  setUsageState(
    campaignId: string,
    transition: UsageTransition
  ): Promise<RecordChange<CampaignRecord> | null>;
  // The fourth answer, and the only one that involves money: another term,
  // priced on its own.
  renewUsage(
    campaignId: string,
    input: UsageRenewalFormValues
  ): Promise<RecordChange<CampaignRecord> | null>;
  // Collects (or un-collects) one renewal's payment, stamping the day it
  // landed the same way setPaymentReceived does for a deal.
  setRenewalPaymentStatus(
    campaignId: string,
    renewalId: string,
    status: CampaignPaymentStatus
  ): Promise<RecordChange<CampaignRecord> | null>;
  // Points the deal at the invoice record that bills it, once that invoice
  // exists, or clears the link with "". Answers the record it wrote, or null
  // when the id matched nothing.
  linkInvoice(campaignId: string, invoiceId: string): Promise<CampaignRecord | null>;
  // Points a renewal at the invoice raised for it, once that invoice exists.
  // Answers the record it wrote, or null when either id matched nothing.
  linkRenewalInvoice(
    campaignId: string,
    renewalId: string,
    invoiceId: string
  ): Promise<CampaignRecord | null>;
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
      invoiceRef: input.invoiceRef,
      paymentDue: input.paymentDue ? toSheetDate(input.paymentDue) : "",
      paidDate: input.paidDate ? toSheetDate(input.paidDate) : "",
      paymentMethod: input.paymentMethod,
      editorTransactionId: input.editorTransactionId,
      usageMonths: input.usageMonths,
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
      invoiceRef: input.invoiceRef,
      paymentDue: input.paymentDue ? toSheetDate(input.paymentDue) : "",
      paidDate: input.paidDate ? toSheetDate(input.paidDate) : "",
      paymentMethod: input.paymentMethod,
      editorTransactionId: input.editorTransactionId,
      usageMonths: input.usageMonths,
    });
  }

  // Stamped with today rather than preserving whatever date was on the record:
  // this is the button on a row that is still pending, so any date already
  // there is a leftover from an earlier mark-and-undo, not a correction.
  async setPaymentReceived(campaignId: string): Promise<CampaignRecord> {
    return setCampaignPaymentStatus(campaignId, "received", today());
  }

  async setPaymentPending(campaignId: string): Promise<CampaignRecord> {
    return setCampaignPaymentStatus(campaignId, "pending", "");
  }

  async schedulePost(
    campaignId: string,
    isoDate: string
  ): Promise<RecordChange<CampaignRecord> | null> {
    return setCampaignUploadDate(campaignId, isoDate ? toSheetDate(isoDate) : "");
  }

  async setUsageState(
    campaignId: string,
    transition: UsageTransition
  ): Promise<RecordChange<CampaignRecord> | null> {
    return transitionCampaignUsage(campaignId, transition, today());
  }

  async renewUsage(
    campaignId: string,
    input: UsageRenewalFormValues
  ): Promise<RecordChange<CampaignRecord> | null> {
    return addCampaignUsageRenewal(campaignId, {
      startDate: input.startDate ? toSheetDate(input.startDate) : today(),
      months: input.months,
      amount: input.amount,
      paymentStatus: input.paymentStatus,
      paymentDue: input.paymentDue ? toSheetDate(input.paymentDue) : "",
      paidDate: input.paidDate ? toSheetDate(input.paidDate) : "",
      paymentMethod: input.paymentMethod,
    });
  }

  async setRenewalPaymentStatus(
    campaignId: string,
    renewalId: string,
    status: CampaignPaymentStatus
  ): Promise<RecordChange<CampaignRecord> | null> {
    return setUsageRenewalPayment(
      campaignId,
      renewalId,
      status,
      status === "received" ? today() : ""
    );
  }

  async linkInvoice(campaignId: string, invoiceId: string): Promise<CampaignRecord | null> {
    return setCampaignInvoice(campaignId, invoiceId);
  }

  async linkRenewalInvoice(
    campaignId: string,
    renewalId: string,
    invoiceId: string
  ): Promise<CampaignRecord | null> {
    return setUsageRenewalInvoice(campaignId, renewalId, invoiceId);
  }
}

export const campaignRepository: ICampaignRepository = new CampaignRepositoryImpl();
