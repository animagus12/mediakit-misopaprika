// Canonical record for a brand deal: barter, paid, or both. This is the
// single source every campaigns/dashboard/earnings projection reads from
// (repositories/brandCampaigns.ts, campaignRepository.ts, earnings.ts),
// replacing what used to be three independent re-parses of the same Google
// Sheet tab. Dates stay DD/MM/YYYY (the sheet's original convention) rather
// than switching to ISO, so every existing date-parsing helper across the
// app (lib/campaigns.ts, lib/brandCampaignStats.ts, ...) keeps working
// unchanged: same choice already made for data/editor-transactions.json.

import { addMonthsToDay, daysBetween } from "@/lib/day";
import { toWorkflowStatus, type WorkflowStatus } from "./workflowStatus";

export type CampaignPaymentStatus = "received" | "pending" | "unknown";

// A deal uses the whole shared vocabulary (see ./workflowStatus), including
// the pre-production and Redacted statuses an own post never has.
export type CampaignStatus = WorkflowStatus;

// Full stored vocabulary, including "Scam": inherited from the original
// spreadsheet's data. Not every value is offered when adding a new deal (see
// lib/campaigns.ts's CAMPAIGN_TYPES); "Scam" is something you'd mark after
// the fact, not pick up front.
export type CampaignType = "Barter" | "Paid" | "Barter+Paid" | "Scam";

// Anything not yet wrapped up is still "active": whitelisting the terminal
// statuses is more robust than listing every pipeline stage, since new
// pipeline stages (e.g. "In Route") show up more often than new terminal ones.
const PAST_STATUSES = new Set<CampaignStatus>(["Posted", "Cancelled", "Redacted"]);

/**
 * The status a stored deal carries, in the shared vocabulary.
 *
 * Rows still spelled the sheet's old way ("Completed", "Todo") are read as
 * their shared name. Anything else unrecognised, a blank included, reads as
 * Discussion: not started is the safe direction, since it can't quietly count
 * a deal as delivered or ready.
 */
export function toCampaignStatus(raw: string | null | undefined): CampaignStatus {
  return toWorkflowStatus(raw) ?? "Discussion";
}
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
  days: number; // length of the extended term, counted from startDate
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
  /**
   * The base term in days, counted from uploadDate. 0 = not tracked.
   *
   * Days rather than months because licences are sold for any length, a
   * one-day boost as readily as a quarter, and a month is not a fixed number
   * of days to convert one into.
   */
  days: number;
  /**
   * Granted with no end date: the brand may run the content for as long as it
   * likes.
   *
   * A flag rather than a very large `days`, because "forever" is a different
   * answer from "a long time": it never expires, so there is nothing to warn
   * about, renew or pause, and a sentinel number would reach every countdown
   * that has to be taught to ignore it. `days` is 0 while this is set.
   */
  indefinite: boolean;
  /**
   * What the brand pays for the base licence, charged on top of the deal's
   * `amount`, 0 when nothing was charged for it.
   *
   * An addition, not a share: `amount` is the price of the post, and the fee
   * is a second price for the right to run it as an ad, the same split the
   * rate card sells. Everything that reads the deal's money reads
   * `Campaign.cash`, which is the two together, so a fee is invoiced, chased
   * and counted as income like the rest of the deal.
   */
  fee: number;
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
  return { days: 0, indefinite: false, fee: 0, status: "active", pausedOn: "", pausedDays: 0, endedOn: "", renewals: [] };
}

/** A renewal as stored: one written before terms moved to days carries `months`. */
export type StoredUsageRenewal = Omit<UsageRenewalRecord, "days"> & { days?: number; months?: number };

/** A licence as stored, in either the days shape or the months one before it. */
export type StoredUsage = Omit<CampaignUsage, "days" | "indefinite" | "fee" | "renewals"> & {
  days?: number;
  indefinite?: boolean;
  months?: number;
  fee?: number;
  renewals?: StoredUsageRenewal[];
};

const SHEET_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

/**
 * A stored term's length in days, converting one recorded in months.
 *
 * Converted as calendar months from the day the term starts, not at a flat
 * thirty days: three months from 10 August is 92 days, and counting it as 90
 * would move the end date of every licence already on the books. Measured this
 * way, a converted licence runs out on exactly the day it did before. With no
 * start date to measure from, thirty days a month stands in. The stored months
 * are converted on every read until the licence is next saved, which writes
 * the days and ends the conversion for that record.
 */
function termDays(raw: { days?: number; months?: number }, startDate: string): number {
  if (raw.days !== undefined) return Math.max(0, Math.round(Number(raw.days) || 0));
  const months = Math.max(0, Math.round(Number(raw.months) || 0));
  if (months === 0) return 0;
  const match = startDate.trim().match(SHEET_DATE);
  if (!match) return months * 30;
  const [, day, month, year] = match;
  const startKey = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  const endKey = addMonthsToDay(startKey, months);
  return endKey ? daysBetween(startKey, endKey) : months * 30;
}

// Legacy rows predate the field entirely, and a hand-edited one can carry
// anything: every campaign read through toCampaign gets a whole, coerced
// object, so nothing downstream has to test for its absence. Records are
// healed on their next write (see normalize in ./campaigns.writer.server).
//
// `termStart` is the DD/MM/YYYY the base term counts from (the upload date,
// falling back to the deal date), used only to convert a term stored in months.
export function toUsage(raw: StoredUsage | undefined, termStart: string): CampaignUsage {
  if (!raw) return emptyUsage();
  // Absent on every licence written before the option existed, all of which
  // had an end date.
  const indefinite = raw.indefinite === true;
  return {
    days: indefinite ? 0 : termDays(raw, termStart),
    indefinite,
    // Absent on every licence written before the split: 0 reads as "not priced
    // separately", which is exactly what those records are.
    fee: Math.max(0, Number(raw.fee) || 0),
    status: raw.status === "paused" || raw.status === "ended" ? raw.status : "active",
    pausedOn: raw.pausedOn?.trim() ?? "",
    pausedDays: Math.max(0, Math.round(Number(raw.pausedDays) || 0)),
    endedOn: raw.endedOn?.trim() ?? "",
    renewals: Array.isArray(raw.renewals)
      ? raw.renewals.map(({ months, days, ...renewal }) => ({
          ...renewal,
          days: termDays({ days, months }, renewal.startDate ?? ""),
        }))
      : [],
  };
}

/** The day a deal's base licence counts from, as toUsage needs it. */
export function usageTermStart(record: Pick<CampaignRecord, "uploadDate" | "date">): string {
  return record.uploadDate?.trim() || record.date;
}

// --- Invoice link --------------------------------------------------------
// A deal points at its invoice two ways, and they are not the same thing.
//
// `invoiceRef` is the linked invoice's number as text ("MSP-INV-0010"),
// written when the link is (see setCampaignInvoice). It used to be typed or
// auto-assigned before any invoice existed; neither happens any more, and a
// deal with no link carries none.
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
 *
 * A reference with no linked invoice reads as "". Those are left over from
 * when a number was typed or handed out before any invoice existed: nothing
 * shows them, and matching one by number is how a renewal renamed to 0007
 * resolved as the invoice of ThisFanon, whose leftover reference was
 * MSP-INV-0007. Blanked on read rather than by a one-off migration, so every
 * reader agrees at once and the store heals on the record's next write.
 */
export function toInvoiceLink(raw: {
  invoiceRef?: string;
  invoiceId?: string | null;
}): CampaignInvoiceLink {
  // Pre-split: `invoiceId` holds a typed reference, and no key exists.
  if (raw.invoiceRef === undefined) return { invoiceRef: "", invoiceId: null };
  const invoiceId = raw.invoiceId?.trim() || null;
  return { invoiceRef: invoiceId ? raw.invoiceRef.trim() : "", invoiceId };
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
  // Pipeline stage (see STATUS_OPTIONS). Coerced on read (see
  // toCampaignStatus), so a legacy spelling never reaches past the store.
  status: CampaignStatus;
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
  usage?: StoredUsage;
}

export interface Campaign extends CampaignRecord {
  /**
   * The deal's cash: `amount` plus the ad usage fee. Derived, never stored.
   *
   * Every read of what a deal is owed or paid in money reads this rather than
   * `amount`, which is only the post's own price and is what the form edits.
   */
  cash: number;
  total: number; // cash + barterValue, derived, never stored, so it can't drift
  stage: CampaignStage; // derived from status, see PAST_STATUSES
  paidDate: string; // "" rather than absent: see toCampaign
  editorTransactionId: string | null; // null rather than absent: see toCampaign
  usage: CampaignUsage; // whole rather than absent: see toUsage
  /** True when `paymentDue` is the linked invoice's due date: see withInvoiceDueDate in lib/invoice.ts. */
  paymentDueFromInvoice: boolean;
}

export interface NewCampaignInput {
  date: string; // DD/MM/YYYY
  brand: string;
  brandId: string | null;
  campaign: string;
  type: CampaignType;
  reels: string;
  story: string;
  status: CampaignStatus;
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
  /** The base licence term in days. Renewals are added separately, never through a form. */
  usageDays?: number;
  /** Granted with no end date. Absent on update keeps the stored setting. */
  usageIndefinite?: boolean;
  /** The latest renewal's length in days. Absent keeps it; ignored with no renewals. */
  usageRenewalDays?: number;
  /** DD/MM/YYYY an ended licence was called off on. Absent keeps it; ignored unless ended. */
  usageEndedOn?: string;
  /** The part of `amount` agreed for the base licence. Absent on update keeps the stored fee. */
  usageFee?: number;
}

export interface CampaignUpdate extends NewCampaignInput {
  id: string;
}

export function toCampaign(record: CampaignRecord): Campaign {
  const status = toCampaignStatus(record.status);
  const usage = toUsage(record.usage, usageTermStart(record));
  const cash = record.amount + usage.fee;
  return {
    ...record,
    ...toInvoiceLink(record),
    status,
    cash,
    total: cash + record.barterValue,
    stage: PAST_STATUSES.has(status) ? "past" : "active",
    paidDate: record.paidDate?.trim() ?? "",
    // An empty string is what a cleared <Select> leaves behind and a row
    // written before the field existed has nothing at all; both mean the same
    // thing, so both settle on null and no reader downstream has to test for
    // two kinds of absence.
    editorTransactionId: record.editorTransactionId?.trim() || null,
    usage,
    // Set by withInvoiceDueDate once the invoices are read alongside.
    paymentDueFromInvoice: false,
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
