"use server";

import { revalidatePath } from "next/cache";
import { revalidateStores } from "@/lib/revalidation";
import { campaignRepository } from "@/repositories/campaignRepository";
import type { CampaignFormUpdate, CampaignFormValues } from "@/repositories/campaignRepository";
import { getBrands, addBrand } from "@/repositories/brands.writer.server";
import { getInvoices, setInvoiceStatus } from "@/repositories/invoices.writer.server";
import type { InvoiceStatus } from "@/repositories/invoices";
import { findInvoiceByCampaignRef } from "@/lib/invoice";
import { normalizeBrandName } from "@/lib/brandCampaignStats";

export interface CreatedBrand {
  id: string;
  name: string;
}

// Resolves a campaign's free-text brand name to a real CRM brand id whenever
// the form's "Link to brand" picker was left untouched: matches an existing
// brand case-insensitively (same convention as importBrandsFromCampaigns in
// app/brands/actions.ts), or creates one on the spot so a campaign is never
// left pointing at nothing. Returns the new brand's {id, name} when one was
// created, so the caller can surface it (toast / "fill in details" nudge): 
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
  // A campaign write can also create a brand (see resolveOrCreateBrandId).
  revalidateStores("campaigns", "brands");
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

/**
 * Moves the invoice a campaign references (Campaign.invoiceId) to `status`,
 * and reports the status it held before, so an Undo can put back exactly what
 * was there rather than guessing at "sent".
 *
 * Returns null when the deal references no invoice, references one that was
 * never saved as a record, or when the invoice is void: a void invoice has
 * been written off, so money landing against the deal does not resurrect it.
 *
 * The campaign write is the action's contract and happens first; this runs
 * after and reports failure separately, because a payment that was collected
 * should still be recorded even if the invoice could not be re-stamped.
 */
async function syncLinkedInvoiceStatus(
  campaignId: string,
  status: InvoiceStatus
): Promise<InvoiceStatus | null> {
  const campaigns = await campaignRepository.getAll();
  const campaign = campaigns.find((entry) => entry.id === campaignId);
  if (!campaign) return null;

  const invoice = findInvoiceByCampaignRef(campaign.invoiceId, await getInvoices());
  if (!invoice || invoice.status === "void" || invoice.status === status) return null;

  await setInvoiceStatus(invoice.id, status);
  return invoice.status;
}

function revalidatePaymentPaths(): void {
  revalidateStores("campaigns", "brands", "invoices");
}

export interface MarkPaymentResult {
  success: true;
  /** The linked invoice's status before this call, for Undo. Null when none moved. */
  previousInvoiceStatus: InvoiceStatus | null;
  /** Set when the payment was recorded but the linked invoice could not be updated. */
  warning?: string;
}

export async function markCampaignPaymentReceived(
  campaignId: string
): Promise<MarkPaymentResult | { success: false; error: string }> {
  if (!campaignId.trim()) {
    return { success: false, error: "This deal has no campaign ID to update" };
  }
  try {
    await campaignRepository.setPaymentReceived(campaignId);
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Couldn't update the payment status",
    };
  }

  // Deliberately outside the write above: the payment is already recorded, so
  // a failure here is reported as a warning rather than rolling the deal back.
  let previousInvoiceStatus: InvoiceStatus | null = null;
  let warning: string | undefined;
  try {
    previousInvoiceStatus = await syncLinkedInvoiceStatus(campaignId, "paid");
  } catch (err) {
    warning = err instanceof Error ? err.message : "The linked invoice wasn't updated";
  }

  revalidatePaymentPaths();
  return { success: true, previousInvoiceStatus, ...(warning ? { warning } : {}) };
}

// Undo for markCampaignPaymentReceived: puts the payment status back to
// pending, and the linked invoice back to whatever it held before that call.
export async function unmarkCampaignPaymentReceived(
  campaignId: string,
  previousInvoiceStatus?: InvoiceStatus | null
): Promise<{ success: true } | { success: false; error: string }> {
  if (!campaignId.trim()) {
    return { success: false, error: "This deal has no campaign ID to update" };
  }
  try {
    await campaignRepository.setPaymentPending(campaignId);
    if (previousInvoiceStatus) {
      await syncLinkedInvoiceStatus(campaignId, previousInvoiceStatus);
    }
    revalidatePaymentPaths();
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Couldn't update the payment status",
    };
  }
}

// Forces the dashboard's Suspense-streamed sections to re-render on the next
// navigation, rather than waiting for a natural revalidation: backs the
// "Refresh" control next to the last-synced time.
export async function refreshDashboard(): Promise<{ success: true }> {
  revalidatePath("/");
  return { success: true };
}
