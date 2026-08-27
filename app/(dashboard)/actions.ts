"use server";

import { revalidatePath } from "next/cache";
import { collaborationRepository } from "@/repositories/collaborations";
import type { CollaborationUpdate, NewCollaboration } from "@/repositories/collaborations";

export async function createCollaboration(
  input: NewCollaboration
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await collaborationRepository.create(input);
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Couldn't save to the sheet",
    };
  }
}

export async function updateCollaboration(
  input: CollaborationUpdate
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await collaborationRepository.update(input);
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Couldn't save to the sheet",
    };
  }
}

export async function markCampaignPaymentReceived(
  campaignId: string
): Promise<{ success: true } | { success: false; error: string }> {
  if (!campaignId.trim()) {
    return { success: false, error: "This deal has no campaign ID to update" };
  }
  try {
    await collaborationRepository.setPaymentReceived(campaignId);
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Couldn't update the sheet",
    };
  }
}

// Undo for markCampaignPaymentReceived — puts the Payment column back to
// pending. Fired from the toast's "Undo" action.
export async function unmarkCampaignPaymentReceived(
  campaignId: string
): Promise<{ success: true } | { success: false; error: string }> {
  if (!campaignId.trim()) {
    return { success: false, error: "This deal has no campaign ID to update" };
  }
  try {
    await collaborationRepository.setPaymentPending(campaignId);
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Couldn't update the sheet",
    };
  }
}

// Forces the dashboard's cached Google Sheets reads to re-fetch on the next
// render, rather than waiting out the 5-minute revalidate window — backs the
// "Refresh" control next to the last-synced time.
export async function refreshDashboard(): Promise<{ success: true }> {
  revalidatePath("/");
  return { success: true };
}
