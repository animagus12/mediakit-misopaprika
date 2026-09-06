import "server-only";
import { getRedis } from "@/lib/cache";
import campaignContactsSeed from "@/data/campaign-contacts.json";
import type { CampaignContact } from "./campaignContacts";

// server-only, and never imported from a client component: the server
// actions and pages that need it import it directly.
const CAMPAIGN_CONTACTS_KEY = "campaign_contacts";
const REDIS_NOT_CONFIGURED = "Upstash Redis not configured: set KV_REST_API_URL and KV_REST_API_TOKEN";
const SEED = campaignContactsSeed as CampaignContact[];

async function readCampaignContacts(): Promise<CampaignContact[]> {
  const redis = getRedis();
  if (!redis) return SEED;
  const stored = await redis.get<CampaignContact[]>(CAMPAIGN_CONTACTS_KEY);
  return stored ?? SEED;
}

export async function getCampaignContacts(): Promise<CampaignContact[]> {
  return readCampaignContacts();
}

// Upsert: one contact per campaign. Passing contactId: null clears the
// assignment (removes the record) instead of storing an empty one.
export async function setCampaignContact(
  campaignId: string,
  brandId: string,
  contactId: string | null
): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  const records = await readCampaignContacts();
  const filtered = records.filter((record) => record.campaignId !== campaignId);
  if (contactId) {
    filtered.push({ campaignId, brandId, contactId, updatedAt: new Date().toISOString() });
  }
  await redis.set(CAMPAIGN_CONTACTS_KEY, filtered);
}

// Cascade for brand deletion.
export async function deleteCampaignContactsForBrand(brandId: string): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  const records = await readCampaignContacts();
  await redis.set(
    CAMPAIGN_CONTACTS_KEY,
    records.filter((record) => record.brandId !== brandId)
  );
}
