"use server";

import { revalidateStores } from "@/lib/revalidation";
import { recordActivity } from "@/repositories/activity.writer.server";
import { describeChanges } from "@/lib/activityDiff";
import { affiliatePartnerFields, affiliatePayoutFields } from "@/lib/activityFields";
import {
  addAffiliatePartner,
  updateAffiliatePartner as updateAffiliatePartnerRecord,
} from "@/repositories/affiliatePartners.writer.server";
import type {
  AffiliatePartnerUpdate,
  NewAffiliatePartner,
} from "@/repositories/affiliatePartners";
import {
  addAffiliatePayout,
  deleteAffiliatePayout,
  updateAffiliatePayout as updateAffiliatePayoutRecord,
} from "@/repositories/affiliatePayouts.writer.server";
import type { AffiliatePayoutUpdate, NewAffiliatePayout } from "@/repositories/affiliatePayouts";
import { getAffiliatePartners } from "@/repositories/affiliatePartners.writer.server";

type ActionResult = { success: true } | { success: false; error: string };

// A payout's own label is a period, which says nothing on its own: the log
// reads "Commission period Overblaze, Mar 2026". Resolving the partner is the
// one extra read each payout action makes, and it is worth it because the
// entity id in the log is a UUID nobody can recognise.
async function partnerLabel(partnerId: string, period: string): Promise<string> {
  const partners = await getAffiliatePartners().catch(() => []);
  const partner = partners.find((entry) => entry.id === partnerId);
  return partner ? `${partner.name}, ${period}` : period;
}

export async function createAffiliatePartner(input: NewAffiliatePartner): Promise<ActionResult> {
  try {
    await addAffiliatePartner(input);
    revalidateStores("affiliatePartners");
    await recordActivity({
      action: "affiliatePartner.created",
      entity: { type: "affiliatePartner", id: null, label: input.name.trim() },
      detail: input.code.trim() || undefined,
    });
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Couldn't save the partner",
    };
  }
}

export async function updateAffiliatePartner(
  input: AffiliatePartnerUpdate
): Promise<ActionResult> {
  try {
    const change = await updateAffiliatePartnerRecord(input);
    revalidateStores("affiliatePartners");
    if (change) {
      await recordActivity({
        action: "affiliatePartner.updated",
        entity: { type: "affiliatePartner", id: change.after.id, label: change.after.name },
        detail: describeChanges(change, affiliatePartnerFields) ?? undefined,
      });
    }
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Couldn't save the partner",
    };
  }
}

export async function createAffiliatePayout(input: NewAffiliatePayout): Promise<ActionResult> {
  try {
    await addAffiliatePayout(input);
    // Both stores, because a payout changes what every partner card reports.
    revalidateStores("affiliatePayouts", "affiliatePartners");
    await recordActivity({
      action: "affiliatePayout.created",
      entity: {
        type: "affiliatePayout",
        id: null,
        label: await partnerLabel(input.partnerId, input.periodEnd),
      },
      amount: input.commissionAmount || undefined,
    });
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Couldn't save the payout",
    };
  }
}

export async function updateAffiliatePayout(input: AffiliatePayoutUpdate): Promise<ActionResult> {
  try {
    const change = await updateAffiliatePayoutRecord(input);
    revalidateStores("affiliatePayouts", "affiliatePartners");
    if (change) {
      // Money landing is the event worth colouring in the feed, the same call
      // campaign.payment_received makes: everything else about a payout is an
      // edit to a figure read off a portal.
      const settled =
        change.before.paymentStatus !== "received" && change.after.paymentStatus === "received";
      await recordActivity({
        action: settled ? "affiliatePayout.paid" : "affiliatePayout.updated",
        entity: {
          type: "affiliatePayout",
          id: change.after.id,
          label: await partnerLabel(change.after.partnerId, change.after.periodEnd),
        },
        detail: settled ? undefined : describeChanges(change, affiliatePayoutFields) ?? undefined,
        amount: change.after.commissionAmount || undefined,
      });
    }
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Couldn't save the payout",
    };
  }
}

export async function removeAffiliatePayout(id: string): Promise<ActionResult> {
  try {
    const removed = await deleteAffiliatePayout(id);
    revalidateStores("affiliatePayouts", "affiliatePartners");
    if (removed) {
      await recordActivity({
        action: "affiliatePayout.deleted",
        entity: {
          type: "affiliatePayout",
          id: removed.id,
          label: await partnerLabel(removed.partnerId, removed.periodEnd),
        },
        amount: removed.commissionAmount || undefined,
      });
    }
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Couldn't remove the payout",
    };
  }
}
