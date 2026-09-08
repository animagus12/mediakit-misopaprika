// Canonical record for a brand deal: barter, paid, or both. This is the
// single source every campaigns/dashboard/earnings projection reads from
// (repositories/brandCampaigns.ts, campaignRepository.ts, earnings.ts),
// replacing what used to be three independent re-parses of the same Google
// Sheet tab. Dates stay DD/MM/YYYY (the sheet's original convention) rather
// than switching to ISO, so every existing date-parsing helper across the
// app (lib/campaigns.ts, lib/brandCampaignStats.ts, ...) keeps working
// unchanged: same choice already made for data/editor-transactions.json.

export type CampaignPaymentStatus = "received" | "pending" | "unknown";

// Full stored vocabulary, including "Scam": inherited from the original
// spreadsheet's data. Not every value is offered when adding a new deal (see
// lib/campaigns.ts's CAMPAIGN_TYPES); "Scam" is something you'd mark after
// the fact, not pick up front.
export type CampaignType = "Barter" | "Paid" | "Barter+Paid" | "Scam";

// Anything not yet wrapped up is still "active": whitelisting the terminal
// statuses is more robust than listing every pipeline stage, since new
// pipeline stages (e.g. "In Route") show up more often than new terminal ones.
const PAST_STATUSES = new Set(["completed", "cancelled", "redacted"]);
export type CampaignStage = "active" | "past";

// --- Usage rights --------------------------------------------------------
// How long a brand may keep running the content as an ad, and what happened
// when that ran out. Modelled on the deal rather than in a store of its own:
// a licence has no existence apart from the post it licenses, it starts from
// that post's upload date, and every renewal of it is money against the same
// brand. A second store would have bought nothing but a join.

export type UsageStatus = "active" | "paused" | "ended";

/**
 * One extension of the licence, priced separately from the deal itself.
 *
 * It carries its own payment fields rather than folding into the campaign's,
 * because it is its own transaction: a deal can be paid and its renewal still
 * outstanding, and collapsing the two would lose which of them is owed. The
 * same reason `Campaign.total` deliberately excludes renewal money (see
 * repositories/earnings.ts, which counts it as its own monthly entry).
 */
export interface UsageRenewalRecord {
  id: string; // "R0001", unique within the deal: see nextSequenceId
  startDate: string; // DD/MM/YYYY the extended term runs from
  months: number;
  amount: number; // 0 for an extension granted for free
  paymentStatus: CampaignPaymentStatus;
  paymentDue: string; // DD/MM/YYYY, "" when nothing was agreed
  paidDate: string; // DD/MM/YYYY the money landed, "" until it does
  paymentMethod: string;
  /**
   * The Invoice raised for this renewal (repositories/invoices.ts), or ""
   * when none was.
   *
   * A real id rather than the free-text "MSP-INV-0007" reference
   * CampaignRecord.invoiceRef carries. A renewal's link is made by the app at
   * the moment both records are written, so there is no reason to weaken it
   * into something that has to be matched back by name.
   */
  invoiceId: string;
  recordedAt: string; // ISO, when the renewal was agreed in the app
}

export interface CampaignUsage {
  /** The base term in months, counted from uploadDate. 0 = not tracked. */
  months: number;
  status: UsageStatus;
  /**
   * DD/MM/YYYY the countdown was frozen on, "" while it is running.
   *
   * A paused licence is one the brand has stopped running, so the days it
   * spends paused are days it does not spend. Storing the day it stopped
   * (and, below, the days already banked) is what lets the term resume
   * exactly where it left off rather than restarting or silently expiring.
   */
  pausedOn: string;
  /** Days already spent paused across every earlier pause. */
  pausedDays: number;
  /** DD/MM/YYYY the licence was called off on, "" while it is live. */
  endedOn: string;
  renewals: UsageRenewalRecord[];
}

export function emptyUsage(): CampaignUsage {
  return { months: 0, status: "active", pausedOn: "", pausedDays: 0, endedOn: "", renewals: [] };
}

// Legacy rows predate the field entirely, and a hand-edited one can carry
// anything: every campaign read through toCampaign gets a whole, coerced
// object, so nothing downstream has to test for its absence. Records are
// healed on their next write (see normalize in ./campaigns.writer.server).
export function toUsage(raw: CampaignUsage | undefined): CampaignUsage {
  if (!raw) return emptyUsage();
  return {
    months: Math.max(0, Math.round(Number(raw.months) || 0)),
    status: raw.status === "paused" || raw.status === "ended" ? raw.status : "active",
    pausedOn: raw.pausedOn?.trim() ?? "",
    pausedDays: Math.max(0, Math.round(Number(raw.pausedDays) || 0)),
    endedOn: raw.endedOn?.trim() ?? "",
    renewals: Array.isArray(raw.renewals) ? raw.renewals : [],
  };
}

// --- Invoice link --------------------------------------------------------
// A deal points at its invoice two ways, and they are not the same thing.
//
// `invoiceRef` is the number a human types or the app auto-assigns
// ("MSP-INV-0010"). It exists before any invoice record does, it is what the
// creator reconciles against a bank statement, and it stays typed text.
//
// `invoiceId` is the real foreign key into repositories/invoices.ts, written
// by the app once a saved invoice is matched to the deal (see
// syncLinkedCampaignPayment in app/invoices/actions.ts). Null until then.
//
// Same split UsageRenewalRecord already made, and the same one
// lib/brandCampaignStats.ts's BrandPaymentRow already renders: the reference
// has to be matched back by number, the key does not.

export interface CampaignInvoiceLink {
  invoiceRef: string;
  invoiceId: string | null;
}

/**
 * Coerces whichever of the two shapes a stored record is in into both fields.
 *
 * Records written before the split carry the reference under `invoiceId`, the
 * name the foreign key now uses, so the presence of an `invoiceRef` key is
 * what marks a record as already migrated: on one that isn't, whatever sits in
 * `invoiceId` is a typed reference and never an Invoice id. Applied on read
 * (see readRecords in ./campaigns.writer.server) so no caller downstream has
 * to know the difference.
 */
export function toInvoiceLink(raw: {
  invoiceRef?: string;
  invoiceId?: string | null;
}): CampaignInvoiceLink {
  if (raw.invoiceRef === undefined) {
    return { invoiceRef: raw.invoiceId?.trim() ?? "", invoiceId: null };
  }
  return { invoiceRef: raw.invoiceRef.trim(), invoiceId: raw.invoiceId?.trim() || null };
}

export interface CampaignRecord extends CampaignInvoiceLink {
  id: string; // e.g. "MSP-BC0014" / "MSP-MC0010": see nextCampaignId()
  date: string; // DD/MM/YYYY, deal date
  uploadDate: string; // DD/MM/YYYY, actual delivery date, "" until posted
  brand: string; // display snapshot, kept even if the linked Brand is renamed/deleted later
  brandId: string | null; // → Brand (repositories/brands.ts); null when this deal isn't linked to a CRM brand
  campaign: string;
  type: CampaignType;
  reels: string; // e.g. "1 Reel" (see REEL_OPTIONS)
  story: string; // e.g. "1 Story" (see STORY_OPTIONS)
  // Pipeline stage (see STATUS_OPTIONS). Deliberately left as a plain string
  // rather than a union: unlike `type`, an off-list value is a normal state
  // here: the status <Select> keeps whatever's already on the record
  // selectable even when it's not one of STATUS_OPTIONS (see
  // components/campaigns/CampaignStatusSelect.tsx): so widening the pipeline
  // never requires a type change.
  status: string;
  amount: number;
  barterValue: number;
  paymentStatus: CampaignPaymentStatus;
  paymentDue: string; // DD/MM/YYYY the payment is expected by, or "" when unset
  /**
   * DD/MM/YYYY the money actually landed, or "" while it hasn't.
   *
   * Separate from paymentDue, which is when it was *meant* to: the gap
   * between the two is the only evidence there is of whether a brand pays
   * when it says it will (see lib/paymentReliability.ts). Optional on the
   * record because rows written before this field existed don't carry it;
   * Campaign below always has one.
   */
  paidDate?: string;
  paymentMethod: string;
  /**
   * The EditorTransaction this deal's video was cut by, or null when it was
   * not sent to an editor. Absent on rows that predate the field.
   *
   * A foreign key rather than an editor's name, and for the same reason
   * ContentItemRecord.editorTransactionId is one: what the link buys is the
   * job behind the cut, which carries who edited it, what it cost and when it
   * came back. A name would answer the first of those and go stale on the
   * day the editor is renamed.
   */
  editorTransactionId?: string | null;
  /** The ad-usage licence on this deal. Absent on rows that predate it. */
  usage?: CampaignUsage;
}

export interface Campaign extends CampaignRecord {
  total: number; // amount + barterValue, derived, never stored, so it can't drift
  stage: CampaignStage; // derived from status, see PAST_STATUSES
  paidDate: string; // "" rather than absent: see toCampaign
  editorTransactionId: string | null; // null rather than absent: see toCampaign
  usage: CampaignUsage; // whole rather than absent: see toUsage
}

export interface NewCampaignInput {
  date: string; // DD/MM/YYYY
  brand: string;
  brandId: string | null;
  campaign: string;
  type: CampaignType;
  reels: string;
  story: string;
  status: string;
  amount: number;
  barterValue: number;
  paymentStatus: CampaignPaymentStatus;
  uploadDate?: string;
  invoiceRef?: string;
  paymentDue?: string;
  paidDate?: string;
  paymentMethod?: string;
  /** The editing job behind the video, or null when there wasn't one. */
  editorTransactionId?: string | null;
  /** The base licence term. Renewals are added separately, never through a form. */
  usageMonths?: number;
}

export interface CampaignUpdate extends NewCampaignInput {
  id: string;
}

export function toCampaign(record: CampaignRecord): Campaign {
  const status = record.status.trim() || "Unknown";
  return {
    ...record,
    ...toInvoiceLink(record),
    status,
    total: record.amount + record.barterValue,
    stage: PAST_STATUSES.has(status.toLowerCase()) ? "past" : "active",
    paidDate: record.paidDate?.trim() ?? "",
    // An empty string is what a cleared <Select> leaves behind and a row
    // written before the field existed has nothing at all; both mean the same
    // thing, so both settle on null and no reader downstream has to test for
    // two kinds of absence.
    editorTransactionId: record.editorTransactionId?.trim() || null,
    usage: toUsage(record.usage),
  };
}

// Highest existing "<prefix><digits>" id + 1, zero-padded to at least 4
// digits: matches the original sheet's "MSP-BC0001" / "MSP-MC0001" /
// "MSP-INV-0001" numbering so the two id families never collide.
export function nextSequenceId(existingIds: string[], prefix: string): string {
  const pattern = new RegExp(`^${prefix}(\\d+)$`);
  let max = 0;
  for (const id of existingIds) {
    const match = id.trim().match(pattern);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}
