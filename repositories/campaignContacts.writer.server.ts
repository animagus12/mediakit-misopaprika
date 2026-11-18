import "server-only";
import { getRedis, readStored } from "@/lib/cache";
import campaignContactsSeed from "@/data/campaign-contacts.json";
import { listOrSeed, type Mutation } from "@/lib/storeMutation";
import { mutateStored } from "@/lib/storeWrite.server";
import type { CampaignContact } from "./campaignContacts";

// server-only, and never imported from a client component: the server
// actions and pages that need it import it directly.
const CAMPAIGN_CONTACTS_KEY = "campaign_contacts";
const SEED = campaignContactsSeed as CampaignContact[];
const toCampaignContacts = listOrSeed(SEED);

async function readCampaignContacts(): Promise<CampaignContact[]> {
  const redis = getRedis();
  if (!redis) return SEED;
  return toCampaignContacts(await readStored<unknown>(CAMPAIGN_CONTACTS_KEY));
}

// Each write is a compare-and-set over the whole list (see
// lib/storeWrite.server.ts), so two saves that overlap are both kept.
function mutateCampaignContacts<R>(change: Mutation<CampaignContact[], R>): Promise<R> {
  return mutateStored(CAMPAIGN_CONTACTS_KEY, toCampaignContacts, change);
}

export async function getCampaignContacts(): Promise<CampaignContact[]> {
  return readCampaignContacts();
}

// Upsert: one contact per campaign. Passing contactId: null clears the
// assignment (removes the record) instead of storing an empty one.
export function setCampaignContact(
  campaignId: string,
  brandId: string,
  contactId: string | null
): Promise<void> {
  return mutateCampaignContacts((records) => {
    const filtered = records.filter((record) => record.campaignId !== campaignId);
    if (contactId) {
      filtered.push({ campaignId, brandId, contactId, updatedAt: new Date().toISOString() });
    }
    return { next: filtered, result: undefined };
  });
}

// Cascade for brand deletion.
export function deleteCampaignContactsForBrand(brandId: string): Promise<void> {
  return removeWhere((record) => record.brandId === brandId);
}

export function deleteCampaignContactsForCampaign(campaignId: string): Promise<void> {
  return removeWhere((record) => record.campaignId === campaignId);
}

function removeWhere(match: (record: CampaignContact) => boolean): Promise<void> {
  return mutateCampaignContacts((records) => ({
    next: records.some(match) ? records.filter((record) => !match(record)) : null,
    result: undefined,
  }));
}

export async function restoreCampaignContacts(records: CampaignContact[]): Promise<void> {
  if (records.length === 0) return;
  await mutateCampaignContacts((current) => {
    const assignments = new Set(current.map((record) => record.campaignId));
    const missing = records.filter((record) => !assignments.has(record.campaignId));
    return { next: missing.length > 0 ? [...current, ...missing] : null, result: undefined };
  });
}
