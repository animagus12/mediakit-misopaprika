import "server-only";
import { getRedis } from "@/lib/cache";
import campaignsSeed from "@/data/campaigns.json";
import type { RecordChange } from "@/lib/activityDiff";
import { daysBetween } from "@/lib/day";
import { toIsoDate } from "@/lib/campaigns";
import {
  emptyUsage,
  nextSequenceId,
  toCampaign,
  toCampaignStatus,
  toInvoiceLink,
  toUsage,
  usageTermStart,
} from "./campaigns";
import type {
  Campaign,
  CampaignPaymentStatus,
  CampaignRecord,
  CampaignUpdate,
  CampaignUsage,
  NewCampaignInput,
  UsageRenewalRecord,
} from "./campaigns";

// server-only, and never imported from a client component: the server
// actions and pages that need it import it directly. Reading/writing
// campaigns goes through Redis (Vercel's serverless filesystem is
// read-only), so that logic lives here rather than in ./campaigns.
const CAMPAIGNS_KEY = "campaigns";
const REDIS_NOT_CONFIGURED = "Upstash Redis not configured: set KV_REST_API_URL and KV_REST_API_TOKEN";
const SEED = campaignsSeed as CampaignRecord[];

// Every record is put through toInvoiceLink and toCampaignStatus on the way
// out, so the rest of this module (and everything downstream of it) only ever
// sees the split invoiceRef/invoiceId shape and the shared status vocabulary,
// never the older forms a stored record may still be in. Healed for good on
// the next write, which writes the whole list back. Coercing here rather than
// only in toCampaign also keeps an update's before and after in the same
// vocabulary, so a legacy "Completed" never logs as a change to "Posted".
async function readRecords(): Promise<CampaignRecord[]> {
  const redis = getRedis();
  const stored = redis ? await redis.get<CampaignRecord[]>(CAMPAIGNS_KEY) : null;
  return (stored ?? SEED).map((record) => ({
    ...record,
    ...toInvoiceLink(record),
    status: toCampaignStatus(record.status),
  }));
}

// Falls back to the bundled data/campaigns.json seed until the first write,
// or whenever Redis isn't configured (e.g. local dev without KV env vars).
export async function getCampaigns(): Promise<Campaign[]> {
  return (await readRecords()).map(toCampaign);
}

// Trims free text and coerces numbers so a record is clean regardless of
// what the form handed over: same defensive shape as brands.writer.server.ts.
// The usage licence is left out: it is the one field a form only ever sets
// part of (the base term), and rewriting it wholesale here would drop the
// renewals the form never sees. addCampaign and updateCampaign compose it.
function normalize(
  input: NewCampaignInput
): Omit<CampaignRecord, "id" | "invoiceRef" | "invoiceId" | "usage"> {
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
    paidDate: input.paidDate?.trim() ?? "",
    paymentMethod: input.paymentMethod?.trim() ?? "",
    editorTransactionId: input.editorTransactionId?.trim() || null,
  };
}

// A licence is granted in whole days; anything else is a typo rather than a
// term, so it is rounded and floored at zero (0 meaning "not tracked").
function usageDays(input: NewCampaignInput): number {
  return Math.max(0, Math.round(Number(input.usageDays) || 0));
}

// An input that leaves the flag out keeps the stored one, for the same reason
// usageFee does. An indefinite licence carries no day count, so a stale one
// left in the form can't resurface if the flag is later cleared by mistake.
function usageTermOf(
  input: NewCampaignInput,
  stored: boolean
): Pick<CampaignUsage, "days" | "indefinite"> {
  const indefinite = input.usageIndefinite ?? stored;
  return { indefinite, days: indefinite ? 0 : usageDays(input) };
}

// The form edits the current term's length, which after a renewal is the
// latest renewal's rather than the base term's: that is the term the end date
// counts from. At least a day, since a renewal of nothing is not a renewal.
function resizeLatestRenewal(
  renewals: UsageRenewalRecord[],
  days: number | undefined
): UsageRenewalRecord[] {
  if (days === undefined || renewals.length === 0) return renewals;
  const length = Math.max(1, Math.round(Number(days) || 0));
  const last = renewals.length - 1;
  return renewals.map((renewal, index) => (index === last ? { ...renewal, days: length } : renewal));
}

// The ad usage fee, charged on top of the amount and floored at zero. An input
// that leaves the fee out keeps the stored one, so a caller that only moves the
// status can't wipe it.
function usageFee(input: NewCampaignInput, stored: number): number {
  return input.usageFee === undefined ? stored : Math.max(0, Number(input.usageFee) || 0);
}

// MC (monetary campaign) / BC (barter campaign) ids match the sheet's original
// "MSP-MC0001" / "MSP-BC0001" convention.
//
// No invoice reference is assigned. Handing a new deal "MSP-INV-0012" before
// any invoice exists showed a number for a document that was never raised,
// made the deal read as invoiced, and collided with invoices numbered on their
// own. A deal gets its number when an invoice is linked to it
// (setCampaignInvoice). A caller-supplied invoiceRef is still kept as given.
export async function addCampaign(input: NewCampaignInput): Promise<CampaignRecord> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  const records = await readRecords();

  const hasPaidComponent = input.type === "Paid" || input.type === "Barter+Paid";
  const id = nextSequenceId(
    records.map((r) => r.id),
    hasPaidComponent ? "MSP-MC" : "MSP-BC"
  );
  const invoiceRef = input.invoiceRef?.trim() ?? "";

  const record: CampaignRecord = {
    id,
    invoiceRef,
    invoiceId: null,
    ...normalize(input),
    usage: { ...emptyUsage(), ...usageTermOf(input, false), fee: usageFee(input, 0) },
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
  const usage = toUsage(before.usage, usageTermStart(before));
  const after: CampaignRecord = {
    ...before,
    ...normalize(input),
    invoiceRef: input.invoiceRef?.trim() ?? before.invoiceRef,
    // Not form-settable: the foreign key is written by linkCampaignInvoice
    // once a saved invoice is matched to the deal, and an edit of the
    // reference must not silently drop it.
    invoiceId: before.invoiceId,
    // The form sets the term's length (the latest renewal's too, once there
    // is one), the fee, and an ended licence's end date. The licence's status,
    // its pause accounting and adding renewals are moved by their own actions
    // and are carried through untouched.
    usage: {
      ...usage,
      ...usageTermOf(input, usage.indefinite),
      fee: usageFee(input, usage.fee),
      renewals: resizeLatestRenewal(usage.renewals, input.usageRenewalDays),
      // Only an ended licence has a day it ended on; on a live one the field
      // would be a date that means nothing, so it is left as stored.
      endedOn:
        usage.status === "ended" && input.usageEndedOn !== undefined
          ? input.usageEndedOn.trim()
          : usage.endedOn,
    },
  };
  await redis.set(CAMPAIGNS_KEY, records.map((record) => (record.id === input.id ? after : record)));
  return { before, after };
}

// Writes just the paymentStatus and the day the money landed, leaving every
// other field untouched. Powers the dashboard's one-click "Mark received"
// action on the payments-due list (and its Undo, which puts it back to
// "pending" and clears the date again).
//
// The date is passed in rather than read off the clock here: what counts as
// "today" is the creator's civil day, which is a policy decision and lives one
// layer up in campaignRepository, next to the other date conversions.
// Answers the record it wrote, so a caller can name the deal without a
// second read of the list this already fetched.
export async function setCampaignPaymentStatus(
  id: string,
  status: CampaignPaymentStatus,
  paidDate: string
): Promise<CampaignRecord> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  const records = await readRecords();
  const found = records.find((r) => r.id === id);
  if (!found) throw new Error(`Campaign "${id}" not found`);
  const updated: CampaignRecord = { ...found, paymentStatus: status, paidDate: paidDate.trim() };
  await redis.set(
    CAMPAIGNS_KEY,
    records.map((record): CampaignRecord => (record.id === id ? updated : record))
  );
  return updated;
}

// Writes just the uploadDate, leaving every other field untouched: the
// content calendar's inline "schedule this" control, and its counterpart for
// clearing a date back off a deal (uploadDate ""). Deliberately not routed
// through updateCampaign, which takes a whole form and would resave thirteen
// other fields to move one.
//
// Answers the record either side of the write, like updateCampaign, so the
// caller can say what the date moved *from* without re-reading the list this
// already holds. Null when the id matched nothing, rather than writing the
// list back unchanged.
export async function setCampaignUploadDate(
  id: string,
  uploadDate: string
): Promise<RecordChange<CampaignRecord> | null> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  const records = await readRecords();
  const before = records.find((record) => record.id === id);
  if (!before) return null;
  const after: CampaignRecord = { ...before, uploadDate: uploadDate.trim() };
  await redis.set(CAMPAIGNS_KEY, records.map((record) => (record.id === id ? after : record)));
  return { before, after };
}

// --- Usage rights ---------------------------------------------------------
// Each of these writes the licence and nothing else, the same narrow shape as
// setCampaignUploadDate: they are fired from a row in a list, not from a form,
// and resaving fifteen other fields to move one is how a list control corrupts
// a record it never displayed.

function writeUsage(
  records: CampaignRecord[],
  before: CampaignRecord,
  usage: CampaignUsage
): { after: CampaignRecord; records: CampaignRecord[] } {
  const after: CampaignRecord = { ...before, usage };
  return { after, records: records.map((record) => (record.id === before.id ? after : record)) };
}

export type UsageTransition = "pause" | "resume" | "end";

/**
 * Freezes a licence's countdown, restarts it, or calls the licence off.
 *
 * `today` is DD/MM/YYYY, passed in rather than read off the clock for the same
 * reason setCampaignPaymentStatus takes its date: which day it is for the
 * reader is a policy decision, and it is made one layer up.
 *
 * Resuming banks the days spent paused so the term picks up exactly where it
 * stopped. It also un-ends an ended licence, which is what makes ending
 * undoable; the pause that may have preceded the end is not restored, since a
 * licence that was called off was not counting down either way.
 */
export async function transitionCampaignUsage(
  id: string,
  transition: UsageTransition,
  today: string
): Promise<RecordChange<CampaignRecord> | null> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  const records = await readRecords();
  const before = records.find((record) => record.id === id);
  if (!before) return null;

  const usage = toUsage(before.usage, usageTermStart(before));
  let next: CampaignUsage;
  if (transition === "pause") {
    next = { ...usage, status: "paused", pausedOn: today, endedOn: "" };
  } else if (transition === "end") {
    next = { ...usage, status: "ended", endedOn: today, pausedOn: "" };
  } else {
    const pausedFrom = toIsoDate(usage.pausedOn);
    const pausedUntil = toIsoDate(today);
    const banked =
      pausedFrom !== "" && pausedUntil !== ""
        ? Math.max(0, daysBetween(pausedFrom, pausedUntil))
        : 0;
    next = {
      ...usage,
      status: "active",
      pausedOn: "",
      pausedDays: usage.pausedDays + banked,
      endedOn: "",
    };
  }

  const written = writeUsage(records, before, next);
  await redis.set(CAMPAIGNS_KEY, written.records);
  return { before, after: written.after };
}

/**
 * Storage-shaped (DD/MM/YYYY) renewal input; the id, the timestamp and the
 * invoice link are assigned here or attached afterwards.
 */
export type NewUsageRenewal = Omit<UsageRenewalRecord, "id" | "recordedAt" | "invoiceId">;

/**
 * Extends the licence by another term, priced separately from the deal.
 *
 * The renewal is appended rather than replacing what came before, so the
 * history of what a brand has paid to keep running a post survives; only the
 * most recent term decides when the licence now runs out (see usageTerm).
 * Renewing revives a paused or ended licence and clears the pause accounting,
 * because the new term starts from its own date rather than resuming the old.
 */
export async function addCampaignUsageRenewal(
  id: string,
  input: NewUsageRenewal
): Promise<RecordChange<CampaignRecord> | null> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  const records = await readRecords();
  const before = records.find((record) => record.id === id);
  if (!before) return null;

  const usage = toUsage(before.usage, usageTermStart(before));
  const renewal: UsageRenewalRecord = {
    id: nextSequenceId(usage.renewals.map((entry) => entry.id), "R"),
    startDate: input.startDate.trim(),
    days: Math.max(0, Math.round(Number(input.days) || 0)),
    amount: Number(input.amount) || 0,
    paymentStatus: input.paymentStatus,
    paymentDue: input.paymentDue.trim(),
    paidDate: input.paidDate.trim(),
    paymentMethod: input.paymentMethod.trim(),
    // Attached by setUsageRenewalInvoice once the invoice exists: the renewal
    // is the contract of the write and must not wait on a second store.
    invoiceId: "",
    recordedAt: new Date().toISOString(),
  };

  const written = writeUsage(records, before, {
    ...usage,
    status: "active",
    pausedOn: "",
    pausedDays: 0,
    endedOn: "",
    renewals: [...usage.renewals, renewal],
  });
  await redis.set(CAMPAIGNS_KEY, written.records);
  return { before, after: written.after };
}

/**
 * Marks one renewal's money as collected, or puts it back to pending.
 *
 * Its own write rather than a branch of setCampaignPaymentStatus: a renewal is
 * a separate transaction from the deal that spawned it, and a deal can be paid
 * while the renewal against it is still owed.
 */
export async function setUsageRenewalPayment(
  id: string,
  renewalId: string,
  status: CampaignPaymentStatus,
  paidDate: string
): Promise<RecordChange<CampaignRecord> | null> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  const records = await readRecords();
  const before = records.find((record) => record.id === id);
  if (!before) return null;

  const usage = toUsage(before.usage, usageTermStart(before));
  if (!usage.renewals.some((renewal) => renewal.id === renewalId)) return null;

  const written = writeUsage(records, before, {
    ...usage,
    renewals: usage.renewals.map((renewal) =>
      renewal.id === renewalId
        ? { ...renewal, paymentStatus: status, paidDate: paidDate.trim() }
        : renewal
    ),
  });
  await redis.set(CAMPAIGNS_KEY, written.records);
  return { before, after: written.after };
}

/**
 * Keeps every deal linked to a brand in step with that brand: `name` rewrites
 * the brand name the deal shows (a rename in the CRM), and null unlinks the
 * deals from a brand being deleted, keeping the name they show.
 *
 * Without this a renamed brand went on showing its old name on every deal, and
 * a deleted one left deals pointing at nothing: recordsForBrand trusts a
 * brandId over the name, so recreating the brand never picked them back up.
 * Answers how many deals it changed; writes nothing when none.
 */
export async function syncCampaignsWithBrand(brandId: string, name: string | null): Promise<number> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  const records = await readRecords();
  let changed = 0;
  const next = records.map((record): CampaignRecord => {
    if (record.brandId !== brandId) return record;
    if (name === null) {
      changed += 1;
      return { ...record, brandId: null };
    }
    if (record.brand === name) return record;
    changed += 1;
    return { ...record, brand: name };
  });
  if (changed > 0) await redis.set(CAMPAIGNS_KEY, next);
  return changed;
}

/**
 * Points a deal at the invoice record that bills it, or clears the link with
 * "".
 *
 * `invoiceRef`, when given, replaces the typed reference too: once a deal is
 * linked, its invoice's number is the one the brand was sent, and a deal still
 * quoting the number it was first handed (after the invoice was raised under
 * another, or renumbered) reads as a second, unrelated document. Left out, the
 * reference is kept while linked.
 *
 * Clearing the link always blanks the reference. A deal with no invoice shows
 * no number, and a leftover one went on matching whatever invoice later took
 * that number (a renewal renamed to 0007 resolved as ThisFanon's invoice).
 * Answers the record it wrote, or null when the id matched nothing.
 */
export async function setCampaignInvoice(
  id: string,
  invoiceId: string,
  invoiceRef?: string
): Promise<CampaignRecord | null> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  const records = await readRecords();
  const before = records.find((record) => record.id === id);
  if (!before) return null;

  const linked = invoiceId.trim() || null;
  const ref = !linked ? "" : invoiceRef === undefined ? before.invoiceRef : invoiceRef.trim();
  if (before.invoiceId === linked && before.invoiceRef === ref) return before;

  const after: CampaignRecord = { ...before, invoiceId: linked, invoiceRef: ref };
  await redis.set(CAMPAIGNS_KEY, records.map((record) => (record.id === id ? after : record)));
  return after;
}

/**
 * Points a renewal at the invoice raised for it.
 *
 * Its own write, run after both records exist, rather than passing the invoice
 * id into addCampaignUsageRenewal. The renewal is what the creator asked for
 * and is written first; raising the invoice is a second store that can fail on
 * its own, and a renewal that exists without its invoice is recoverable in a
 * way that an invoice for a renewal that was never saved is not.
 */
export async function setUsageRenewalInvoice(
  id: string,
  renewalId: string,
  invoiceId: string
): Promise<CampaignRecord | null> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  const records = await readRecords();
  const before = records.find((record) => record.id === id);
  if (!before) return null;

  const usage = toUsage(before.usage, usageTermStart(before));
  if (!usage.renewals.some((renewal) => renewal.id === renewalId)) return null;

  const written = writeUsage(records, before, {
    ...usage,
    renewals: usage.renewals.map((renewal) =>
      renewal.id === renewalId ? { ...renewal, invoiceId: invoiceId.trim() } : renewal
    ),
  });
  await redis.set(CAMPAIGNS_KEY, written.records);
  return written.after;
}
