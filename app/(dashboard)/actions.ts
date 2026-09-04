"use server";

import { revalidatePath } from "next/cache";
import { campaignRepository } from "@/repositories/campaignRepository";
import type { CampaignFormUpdate, CampaignFormValues } from "@/repositories/campaignRepository";
import { getBrands, addBrand } from "@/repositories/brands.writer.server";
import { normalizeBrandName } from "@/lib/brandCampaignStats";

export interface CreatedBrand {
  id: string;
  name: string;
}

// Resolves a campaign's free-text brand name to a real CRM brand id whenever
// the form's "Link to brand" picker was left untouched — matches an existing
// brand case-insensitively (same convention as importBrandsFromCampaigns in
// app/brands/actions.ts), or creates one on the spot so a campaign is never
// left pointing at nothing. Returns the new brand's {id, name} when one was
// created, so the caller can surface it (toast / "fill in details" nudge) —
// null when nothing needed creating.
async function resolveOrCreateBrandId(
  brandId: string | null,
  brandName: string,
  campaignStatus: string
): Promise<{ brandId: string | null; createdBrand: CreatedBrand | null }> {
  const name = brandName.trim();
  if (brandId || !name) return { brandId, createdBrand: null };

  const brands = await getBrands();
  const key = normalizeBrandName(name);
  const existing = brands.find((brand) => normalizeBrandName(brand.name) === key);
  if (existing) return { brandId: existing.id, createdBrand: null };

  // A freshly-created brand is "Active" by default; only a campaign added as
  // already-Completed implies a finished collaboration ("Worked With").
  const status = campaignStatus.trim().toLowerCase() === "completed" ? "Worked With" : "Active";
  const created = await addBrand({
    name,
    logoUrl: null,
    website: "",
    instagram: "",
    agencyId: null,
    primaryContactId: null,
    status,
  });
  return { brandId: created.id, createdBrand: { id: created.id, name: created.name } };
}

function revalidateCampaignPaths(): void {
  revalidatePath("/");
  revalidatePath("/campaigns");
  revalidatePath("/brands");
}

export async function createCampaign(
  input: CampaignFormValues
): Promise<{ success: true; createdBrand: CreatedBrand | null } | { success: false; error: string }> {
  try {
    const { brandId, createdBrand } = await resolveOrCreateBrandId(input.brandId, input.brand, input.status);
    await campaignRepository.create({ ...input, brandId });
    revalidateCampaignPaths();
    return { success: true, createdBrand };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Couldn't save the campaign",
    };
  }
}

export async function updateCampaign(
  input: CampaignFormUpdate
): Promise<{ success: true; createdBrand: CreatedBrand | null } | { success: false; error: string }> {
  try {
    const { brandId, createdBrand } = await resolveOrCreateBrandId(input.brandId, input.brand, input.status);
    await campaignRepository.update({ ...input, brandId });
    revalidateCampaignPaths();
    return { success: true, createdBrand };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Couldn't save the campaign",
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
    await campaignRepository.setPaymentReceived(campaignId);
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Couldn't update the payment status",
    };
  }
}

// Undo for markCampaignPaymentReceived — puts the payment status back to
// pending. Fired from the toast's "Undo" action.
export async function unmarkCampaignPaymentReceived(
  campaignId: string
): Promise<{ success: true } | { success: false; error: string }> {
  if (!campaignId.trim()) {
    return { success: false, error: "This deal has no campaign ID to update" };
  }
  try {
    await campaignRepository.setPaymentPending(campaignId);
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Couldn't update the payment status",
    };
  }
}

// Forces the dashboard's Suspense-streamed sections to re-render on the next
// navigation, rather than waiting for a natural revalidation — backs the
// "Refresh" control next to the last-synced time.
export async function refreshDashboard(): Promise<{ success: true }> {
  revalidatePath("/");
  return { success: true };
}
