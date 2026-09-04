// Canonical record for a brand deal — barter, paid, or both. This is the
// single source every campaigns/dashboard/earnings projection reads from
// (repositories/brandCampaigns.ts, campaignRepository.ts, earnings.ts),
// replacing what used to be three independent re-parses of the same Google
// Sheet tab. Dates stay DD/MM/YYYY (the sheet's original convention) rather
// than switching to ISO, so every existing date-parsing helper across the
// app (lib/campaigns.ts, lib/brandCampaignStats.ts, ...) keeps working
// unchanged — same choice already made for data/editor-transactions.json.

export type CampaignPaymentStatus = "received" | "pending" | "unknown";

// Full stored vocabulary, including "Scam" — inherited from the original
// spreadsheet's data. Not every value is offered when adding a new deal (see
// lib/campaigns.ts's CAMPAIGN_TYPES); "Scam" is something you'd mark after
// the fact, not pick up front.
export type CampaignType = "Barter" | "Paid" | "Barter+Paid" | "Scam";

// Anything not yet wrapped up is still "active" — whitelisting the terminal
// statuses is more robust than listing every pipeline stage, since new
// pipeline stages (e.g. "In Route") show up more often than new terminal ones.
const PAST_STATUSES = new Set(["completed", "cancelled", "redacted"]);
export type CampaignStage = "active" | "past";

export interface CampaignRecord {
  id: string; // e.g. "MSP-BC0014" / "MSP-MC0010" — see nextCampaignId()
  invoiceId: string; // free-text reference (e.g. "MSP-INV-0010"), "" when none
  date: string; // DD/MM/YYYY — deal date
  uploadDate: string; // DD/MM/YYYY — actual delivery date, "" until posted
  brand: string; // display snapshot — kept even if the linked Brand is renamed/deleted later
  brandId: string | null; // → Brand (repositories/brands.ts); null when this deal isn't linked to a CRM brand
  campaign: string;
  type: CampaignType;
  reels: string; // e.g. "1 Reel" (see REEL_OPTIONS)
  story: string; // e.g. "1 Story" (see STORY_OPTIONS)
  // Pipeline stage (see STATUS_OPTIONS). Deliberately left as a plain string
  // rather than a union: unlike `type`, an off-list value is a normal state
  // here — the status <Select> keeps whatever's already on the record
  // selectable even when it's not one of STATUS_OPTIONS (see
  // components/campaigns/CampaignStatusSelect.tsx) — so widening the pipeline
  // never requires a type change.
  status: string;
  amount: number;
  barterValue: number;
  paymentStatus: CampaignPaymentStatus;
  paymentDue: string; // DD/MM/YYYY the payment is expected by, or "" when unset
  paymentMethod: string;
  notes: string;
}

export interface Campaign extends CampaignRecord {
  total: number; // amount + barterValue — derived, never stored, so it can't drift
  stage: CampaignStage; // derived from status — see PAST_STATUSES
}

export interface NewCampaignInput {
  date: string; // DD/MM/YYYY
  brand: string;
  brandId: string | null;
  campaign: string;
  type: CampaignType;
  reels: string;
  story: string;
  status: string;
  amount: number;
  barterValue: number;
  paymentStatus: CampaignPaymentStatus;
  uploadDate?: string;
  invoiceId?: string;
  paymentDue?: string;
  paymentMethod?: string;
  notes?: string;
}

export interface CampaignUpdate extends NewCampaignInput {
  id: string;
}

export function toCampaign(record: CampaignRecord): Campaign {
  const status = record.status.trim() || "Unknown";
  return {
    ...record,
    status,
    total: record.amount + record.barterValue,
    stage: PAST_STATUSES.has(status.toLowerCase()) ? "past" : "active",
  };
}

// Highest existing "<prefix><digits>" id + 1, zero-padded to at least 4
// digits — matches the original sheet's "MSP-BC0001" / "MSP-MC0001" /
// "MSP-INV-0001" numbering so the two id families never collide.
export function nextSequenceId(existingIds: string[], prefix: string): string {
  const pattern = new RegExp(`^${prefix}(\\d+)$`);
  let max = 0;
  for (const id of existingIds) {
    const match = id.trim().match(pattern);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}
