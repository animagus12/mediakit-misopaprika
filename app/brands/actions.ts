"use server";

import { revalidateStores } from "@/lib/revalidation";
import { addAgency, updateAgency as updateAgencyRecord } from "@/repositories/agencies.writer.server";
import type { AgencyUpdate, NewAgency } from "@/repositories/agencies";
import {
  addBrand,
  getBrands,
  setBrandLogo,
  updateBrand as updateBrandRecord,
  deleteBrand as deleteBrandRecord,
} from "@/repositories/brands.writer.server";
import type { BrandUpdate, NewBrand } from "@/repositories/brands";
import { fetchBrandCampaignRecords } from "@/repositories/brandCampaigns";
import {
  addContact,
  updateContact as updateContactRecord,
  deleteContact as deleteContactRecord,
  deleteContactsForBrand,
} from "@/repositories/contacts.writer.server";
import type { ContactUpdate, NewContact } from "@/repositories/contacts";
import {
  addBrandNote,
  deleteBrandNote as deleteBrandNoteRecord,
  deleteBrandNotesForBrand,
} from "@/repositories/brandNotes.writer.server";
import type { NewBrandNote } from "@/repositories/brandNotes";
import { setCampaignContact, deleteCampaignContactsForBrand } from "@/repositories/campaignContacts.writer.server";

type ActionResult = { success: true } | { success: false; error: string };

function toActionError(err: unknown, fallback: string): ActionResult {
  return { success: false, error: err instanceof Error ? err.message : fallback };
}

export async function createAgency(input: NewAgency): Promise<ActionResult> {
  try {
    await addAgency(input);
    revalidateStores("agencies");
    return { success: true };
  } catch (err) {
    return toActionError(err, "Couldn't save the agency");
  }
}

export async function updateAgency(input: AgencyUpdate): Promise<ActionResult> {
  try {
    await updateAgencyRecord(input);
    revalidateStores("agencies");
    return { success: true };
  } catch (err) {
    return toActionError(err, "Couldn't save the agency");
  }
}

export async function createBrand(
  input: NewBrand
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  try {
    const brand = await addBrand(input);
    revalidateStores("brands");
    return { success: true, id: brand.id };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Couldn't save the brand" };
  }
}

export async function updateBrand(input: BrandUpdate): Promise<ActionResult> {
  try {
    await updateBrandRecord(input);
    revalidateStores("brands");
    return { success: true };
  } catch (err) {
    return toActionError(err, "Couldn't save the brand");
  }
}

// Attaches an already-uploaded media kit logo to a brand instead of
// re-uploading the same image: see components/brands/MediaKitLogosSection.tsx.
export async function assignBrandLogo(brandId: string, logoUrl: string): Promise<ActionResult> {
  try {
    await setBrandLogo(brandId, logoUrl);
    revalidateStores("brands");
    return { success: true };
  } catch (err) {
    return toActionError(err, "Couldn't assign the logo");
  }
}

export async function removeBrand(id: string): Promise<ActionResult> {
  try {
    // Direct contacts/notes/campaign-contact assignments only belong to this
    // brand: agency contacts stay, since they still rep the agency's other
    // brands.
    await Promise.all([
      deleteContactsForBrand(id),
      deleteBrandNotesForBrand(id),
      deleteCampaignContactsForBrand(id),
    ]);
    await deleteBrandRecord(id);
    revalidateStores("brands", "contacts", "brandNotes", "campaignContacts");
    return { success: true };
  } catch (err) {
    return toActionError(err, "Couldn't remove the brand");
  }
}

// One contact per campaign: this brand's campaign records are read-only on
// the brand detail page, so which agent/contact handled a given deal is
// tracked separately here rather than on the campaign record itself.
// contactId: null clears it.
export async function assignCampaignContact(
  campaignId: string,
  brandId: string,
  contactId: string | null
): Promise<ActionResult> {
  try {
    await setCampaignContact(campaignId, brandId, contactId);
    revalidateStores("campaignContacts");
    return { success: true };
  } catch (err) {
    return toActionError(err, "Couldn't assign the contact");
  }
}

// Additive only: creates a Brand for every distinct name across all
// campaign records that isn't already in the CRM (matched case-insensitively,
// same as the uniqueness guard in brands.writer.server.ts), skips the rest.
// Safe to re-run whenever a new brand shows up in a campaign. Everything
// beyond the name (agency, contacts, logo, real status) isn't tracked on a
// campaign record, so imported brands land as "Worked With": there's a real
// deal on record, but no signal for finer-grained status: for the creator
// to refine by hand.
export async function importBrandsFromCampaigns(): Promise<
  { success: true; imported: number; skipped: number } | { success: false; error: string }
> {
  try {
    const [records, existingBrands] = await Promise.all([fetchBrandCampaignRecords(), getBrands()]);
    const existingNames = new Set(existingBrands.map((brand) => brand.name.trim().toLowerCase()));

    const campaignBrands = new Map<string, string>(); // lowercase -> first-seen casing
    for (const record of records) {
      const name = record.brand.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (!campaignBrands.has(key)) campaignBrands.set(key, name);
    }

    let imported = 0;
    let skipped = 0;
    // Sequential: each addBrand() read-modify-writes the whole brands list,
    // so running these concurrently would drop all but the last write.
    for (const [key, name] of campaignBrands) {
      if (existingNames.has(key)) {
        skipped += 1;
        continue;
      }
      await addBrand({
        name,
        logoUrl: null,
        website: "",
        instagram: "",
        agencyId: null,
        primaryContactId: null,
        status: "Worked With",
      });
      imported += 1;
    }

    revalidateStores("brands");
    return { success: true, imported, skipped };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Couldn't import brands from campaigns" };
  }
}

export async function createContact(
  input: NewContact
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  try {
    const contact = await addContact(input);
    revalidateStores("contacts", "brands");
    return { success: true, id: contact.id };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Couldn't save the contact" };
  }
}

export async function updateContact(input: ContactUpdate): Promise<ActionResult> {
  try {
    await updateContactRecord(input);
    revalidateStores("contacts", "brands");
    return { success: true };
  } catch (err) {
    return toActionError(err, "Couldn't save the contact");
  }
}

// brandId is no longer a parameter: revalidateStores() derives the affected
// pages from the store, so the caller does not have to know them.
export async function removeContact(id: string): Promise<ActionResult> {
  try {
    await deleteContactRecord(id);
    revalidateStores("contacts", "brands");
    return { success: true };
  } catch (err) {
    return toActionError(err, "Couldn't remove the contact");
  }
}

export async function createBrandNote(input: NewBrandNote): Promise<ActionResult> {
  try {
    await addBrandNote(input);
    revalidateStores("brandNotes");
    return { success: true };
  } catch (err) {
    return toActionError(err, "Couldn't save the note");
  }
}

export async function removeBrandNote(id: string): Promise<ActionResult> {
  try {
    await deleteBrandNoteRecord(id);
    revalidateStores("brandNotes");
    return { success: true };
  } catch (err) {
    return toActionError(err, "Couldn't remove the note");
  }
}

