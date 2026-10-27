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
import { readPaymentRecords } from "@/repositories/paymentRecords.server";
import type { PaymentRecord } from "@/repositories/payments";
import { removePaymentsWhere } from "@/repositories/payments.writer.server";
import { addTrashEntry, activateTrashEntry, removeTrashEntry } from "@/repositories/trash.writer.server";
import type { TrashPayload } from "@/repositories/trash";
import { requireSession } from "@/lib/session.server";

type DeleteCampaignResult = { success: true; trashId?: string } | { success: false; error: string };

export async function deleteCampaign(id: string): Promise<DeleteCampaignResult> {
  const denied = await requireSession();
  if (denied) return denied;

  let trashId: string | null = null;
  let removed = false;

  try {
    const record = await getCampaignRecord(id);
    if (!record) return { success: false, error: "That campaign no longer exists" };
    const contacts = (await getCampaignContacts()).filter((contact) => contact.campaignId === id);
    // The deal's payments and its renewals' go to Trash with it, so restoring
    // the deal brings its money back and nothing is left counting against a
    // deal no page shows.
    const ownsPayment = (payment: PaymentRecord) => payment.target.kind !== "invoice" && payment.target.campaignId === id;
    const payments = (await readPaymentRecords()).filter(ownsPayment);
    const payload: TrashPayload = { type: "campaign", record, contacts, payments };
    trashId = await addTrashEntry(payload, campaignLabel(record.campaign, record.brand));

    const deleted = await deleteCampaignRecord(id);
    if (!deleted) {
      await removeTrashEntry(trashId);
      return { success: false, error: "That campaign no longer exists" };
    }
    removed = true;

    await deleteCampaignContactsForCampaign(id);
    if (payments.length > 0) await removePaymentsWhere(ownsPayment);
    await activateTrashEntry(trashId);
    revalidateStores("campaigns", "campaignContacts", "payments");
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
