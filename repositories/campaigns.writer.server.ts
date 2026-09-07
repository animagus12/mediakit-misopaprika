import "server-only";
import { getRedis } from "@/lib/cache";
import campaignsSeed from "@/data/campaigns.json";
import type { RecordChange } from "@/lib/activityDiff";
import { nextSequenceId, toCampaign } from "./campaigns";
import type { Campaign, CampaignPaymentStatus, CampaignRecord, CampaignUpdate, NewCampaignInput } from "./campaigns";

// server-only, and never imported from a client component: the server
// actions and pages that need it import it directly. Reading/writing
// campaigns goes through Redis (Vercel's serverless filesystem is
// read-only), so that logic lives here rather than in ./campaigns.
const CAMPAIGNS_KEY = "campaigns";
const REDIS_NOT_CONFIGURED = "Upstash Redis not configured: set KV_REST_API_URL and KV_REST_API_TOKEN";
const SEED = campaignsSeed as CampaignRecord[];

async function readRecords(): Promise<CampaignRecord[]> {
  const redis = getRedis();
  if (!redis) return SEED;
  const stored = await redis.get<CampaignRecord[]>(CAMPAIGNS_KEY);
  return stored ?? SEED;
}

// Falls back to the bundled data/campaigns.json seed until the first write,
// or whenever Redis isn't configured (e.g. local dev without KV env vars).
export async function getCampaigns(): Promise<Campaign[]> {
  return (await readRecords()).map(toCampaign);
}

// Trims free text and coerces numbers so a record is clean regardless of
// what the form handed over: same defensive shape as brands.writer.server.ts.
function normalize(input: NewCampaignInput): Omit<CampaignRecord, "id" | "invoiceId"> {
  return {
    date: input.date,
    brand: input.brand.trim(),
    brandId: input.brandId,
    campaign: input.campaign.trim(),
    type: input.type,
    reels: input.reels,
    story: input.story,
    status: input.status,
    amount: Number(input.amount) || 0,
    barterValue: Number(input.barterValue) || 0,
    paymentStatus: input.paymentStatus,
    uploadDate: input.uploadDate?.trim() ?? "",
    paymentDue: input.paymentDue?.trim() ?? "",
    paymentMethod: input.paymentMethod?.trim() ?? "",
    notes: input.notes?.trim() ?? "",
  };
}

// MC (monetary campaign) gets an auto-assigned invoice id; BC (barter
// campaign) doesn't: matches the sheet's original "MSP-BC0001" /
// "MSP-MC0001" + "MSP-INV-0001" convention. A caller-supplied invoiceId
// (e.g. entered by hand for a barter deal) always wins.
export async function addCampaign(input: NewCampaignInput): Promise<CampaignRecord> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  const records = await readRecords();

  const hasPaidComponent = input.type === "Paid" || input.type === "Barter+Paid";
  const id = nextSequenceId(
    records.map((r) => r.id),
    hasPaidComponent ? "MSP-MC" : "MSP-BC"
  );
  const invoiceId =
    input.invoiceId?.trim() ||
    (hasPaidComponent ? nextSequenceId(records.map((r) => r.invoiceId), "MSP-INV-") : "");

  const record: CampaignRecord = {
    id,
    invoiceId,
    ...normalize(input),
  };
  await redis.set(CAMPAIGNS_KEY, [...records, record]);
  return record;
}

// Answers the record either side of the write, or null when the id matched
// nothing, so the caller can say what actually changed without re-reading the
// list this already holds. Comparing against the caller's input instead would
// be wrong: the normalising below means a trailing space would read as an edit.
export async function updateCampaign(
  input: CampaignUpdate
): Promise<RecordChange<CampaignRecord> | null> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  const records = await readRecords();
  const before = records.find((record) => record.id === input.id);
  if (!before) return null;
  const after: CampaignRecord = {
    ...before,
    ...normalize(input),
    invoiceId: input.invoiceId?.trim() ?? before.invoiceId,
  };
  await redis.set(CAMPAIGNS_KEY, records.map((record) => (record.id === input.id ? after : record)));
  return { before, after };
}

// Writes just the paymentStatus, leaving every other field untouched. Powers
// the dashboard's one-click "Mark received" action on the payments-due list
// (and its Undo, which puts it back to "pending").
// Answers the record it wrote, so a caller can name the deal without a
// second read of the list this already fetched.
export async function setCampaignPaymentStatus(
  id: string,
  status: CampaignPaymentStatus
): Promise<CampaignRecord> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  const records = await readRecords();
  const found = records.find((r) => r.id === id);
  if (!found) throw new Error(`Campaign "${id}" not found`);
  const updated: CampaignRecord = { ...found, paymentStatus: status };
  await redis.set(
    CAMPAIGNS_KEY,
    records.map((record): CampaignRecord => (record.id === id ? updated : record))
  );
  return updated;
}
