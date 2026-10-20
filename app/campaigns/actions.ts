"use server";

import { revalidateStores } from "@/lib/revalidation";
import { campaignLabel } from "@/lib/campaigns";
import { recordActivity } from "@/repositories/activity.writer.server";
import {
  deleteCampaign as deleteCampaignRecord,
  getCampaignRecord,
} from "@/repositories/campaigns.writer.server";
import {
  deleteCampaignContactsForCampaign,
  getCampaignContacts,
} from "@/repositories/campaignContacts.writer.server";
import { addTrashEntry, activateTrashEntry, removeTrashEntry } from "@/repositories/trash.writer.server";
import type { TrashPayload } from "@/repositories/trash";

type DeleteCampaignResult = { success: true; trashId?: string } | { success: false; error: string };

export async function deleteCampaign(id: string): Promise<DeleteCampaignResult> {
  let trashId: string | null = null;
  let removed = false;

  try {
    const record = await getCampaignRecord(id);
    if (!record) return { success: false, error: "That campaign no longer exists" };
    const contacts = (await getCampaignContacts()).filter((contact) => contact.campaignId === id);
    const payload: TrashPayload = { type: "campaign", record, contacts };
    trashId = await addTrashEntry(payload, campaignLabel(record.campaign, record.brand));

    const deleted = await deleteCampaignRecord(id);
    if (!deleted) {
      await removeTrashEntry(trashId);
      return { success: false, error: "That campaign no longer exists" };
    }
    removed = true;

    await deleteCampaignContactsForCampaign(id);
    await activateTrashEntry(trashId);
    revalidateStores("campaigns", "campaignContacts");
    await recordActivity({
      action: "campaign.deleted",
      entity: {
        type: "campaign",
        id: deleted.id,
        label: campaignLabel(deleted.campaign, deleted.brand),
      },
    });
    return { success: true, trashId };
  } catch (error) {
    if (trashId) {
      if (removed) {
        await activateTrashEntry(trashId);
        revalidateStores("campaigns", "campaignContacts");
      } else {
        await removeTrashEntry(trashId);
      }
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Couldn't delete the campaign",
    };
  }
}
