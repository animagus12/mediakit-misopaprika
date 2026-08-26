import "server-only";
import { appendCampaign, fetchCampaigns, type CampaignRow } from "@/services/campaigns";
import type { CollaborationType } from "@/lib/collaborations";

export type { CollaborationType };

export type CollaborationStage = "active" | "past";

export interface Collaboration {
  id: string;
  brand: string;
  campaign: string;
  type: string;
  reels: string;
  story: string;
  status: string;
  date: string;
  total: number;
  stage: CollaborationStage;
}

export interface NewCollaboration {
  brand: string;
  campaign: string;
  type: CollaborationType;
  reels: string; // one of REEL_OPTIONS
  story: string; // one of STORY_OPTIONS
  status: string; // one of STATUS_OPTIONS
  amount: number;
  barterValue: number;
  date: string; // "yyyy-mm-dd", as produced by <input type="date">
}

// Anything not yet wrapped up is still "active" — whitelisting the terminal
// statuses is more robust than listing every pipeline stage, since new
// pipeline stages (e.g. "In Route") show up more often than new terminal ones.
const PAST_STATUSES = new Set(["completed", "cancelled", "redacted"]);

// The sheet's dates are DD/MM/YYYY; <input type="date"> gives yyyy-mm-dd.
function toSheetDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return isoDate;
  return `${day}/${month}/${year}`;
}

function toCollaboration(row: CampaignRow): Collaboration {
  const status = row.status.trim() || "Unknown";
  return {
    id: row.campaignId || `${row.brand}-${row.date}-${row.campaign}`,
    brand: row.brand,
    campaign: row.campaign,
    type: row.type,
    reels: row.reels,
    story: row.story,
    status,
    date: row.date,
    total: row.total,
    stage: PAST_STATUSES.has(status.toLowerCase()) ? "past" : "active",
  };
}

export interface ICollaborationRepository {
  getAll(): Promise<Collaboration[]>;
  create(input: NewCollaboration): Promise<void>;
}

class SheetsCollaborationRepository implements ICollaborationRepository {
  async getAll(): Promise<Collaboration[]> {
    const rows = await fetchCampaigns();
    return rows.map(toCollaboration);
  }

  async create(input: NewCollaboration): Promise<void> {
    await appendCampaign({
      date: toSheetDate(input.date),
      brand: input.brand,
      campaign: input.campaign,
      type: input.type,
      reels: input.reels,
      story: input.story,
      status: input.status,
      amount: input.amount,
      barterValue: input.barterValue,
    });
  }
}

export const collaborationRepository: ICollaborationRepository = new SheetsCollaborationRepository();
