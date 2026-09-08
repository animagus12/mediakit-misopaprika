"use server";

import { revalidatePath } from "next/cache";
import { revalidateStores } from "@/lib/revalidation";
import { recordActivity } from "@/repositories/activity.writer.server";
import { describeChanges } from "@/lib/activityDiff";
import { campaignFields } from "@/lib/activityFields";
import { campaignRepository } from "@/repositories/campaignRepository";
import type {
  CampaignFormUpdate,
  CampaignFormValues,
  CampaignPaymentStatus,
  CampaignRecord,
  UsageRenewalFormValues,
  UsageTransition,
} from "@/repositories/campaignRepository";
import type { ActivityAction } from "@/repositories/activity";
import { getBrands, addBrand } from "@/repositories/brands.writer.server";
import { addInvoice, getInvoices, setInvoiceStatus } from "@/repositories/invoices.writer.server";
import { getInvoiceData, saveInvoiceData } from "@/repositories/invoice.writer.server";
import { getContacts } from "@/repositories/contacts.writer.server";
import { primaryContactForBrand } from "@/lib/contacts";
import { buildRenewalInvoice, nextInvoiceNo } from "@/lib/usageInvoice";
import { buildInvoiceNumber, computeSubtotal, todayISO } from "@/lib/invoice";
import type { InvoiceStatus } from "@/repositories/invoices";
import { resolveCampaignInvoice } from "@/lib/invoice";
import { normalizeBrandName } from "@/lib/brandCampaignStats";
import { campaignLabel, toIsoDate } from "@/lib/campaigns";

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
    const record = await campaignRepository.create({ ...input, brandId });
    revalidateCampaignPaths();
    await recordActivity({
      action: "campaign.created",
      entity: { type: "campaign", id: record.id, label: campaignLabel(input.campaign, input.brand) },
      detail: input.brand.trim() || undefined,
      amount: input.amount + input.barterValue,
    });
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
    const change = await campaignRepository.update({ ...input, brandId });
    revalidateCampaignPaths();
    if (change) {
      await recordActivity({
        action: "campaign.updated",
        entity: {
          type: "campaign",
          id: change.after.id,
          label: campaignLabel(change.after.campaign, change.after.brand),
        },
        detail: describeChanges(change, campaignFields) ?? (change.after.brand.trim() || undefined),
        amount: change.after.amount + change.after.barterValue,
      });
    }
    return { success: true, createdBrand };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Couldn't save the campaign",
    };
  }
}

/**
 * Moves the invoice a campaign is billed by (its invoiceId foreign key, or
 * failing that the invoiceRef it quotes) to `status`, and reports the status it
 * held before, so an Undo can put back exactly what was there rather than
 * guessing at "sent".
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

  const invoice = resolveCampaignInvoice(campaign, await getInvoices());
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
  let campaign: CampaignRecord;
  try {
    campaign = await campaignRepository.setPaymentReceived(campaignId);
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
  await recordActivity({
    action: "campaign.payment_received",
    entity: {
      type: "campaign",
      id: campaign.id,
      label: campaignLabel(campaign.campaign, campaign.brand),
    },
    detail: campaign.brand.trim() || undefined,
    amount: campaign.amount,
  });
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
    const campaign = await campaignRepository.setPaymentPending(campaignId);
    if (previousInvoiceStatus) {
      await syncLinkedInvoiceStatus(campaignId, previousInvoiceStatus);
    }
    revalidatePaymentPaths();
    // The Undo is logged as its own event rather than by removing the one it
    // reverses: an audit trail that rewrites itself isn't one.
    await recordActivity({
      action: "campaign.payment_reverted",
      entity: {
        type: "campaign",
        id: campaign.id,
        label: campaignLabel(campaign.campaign, campaign.brand),
      },
      detail: campaign.brand.trim() || undefined,
      amount: campaign.amount,
    });
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

// --- Ad usage rights ------------------------------------------------------
// The four answers to "this licence is about to run out", plus collecting the
// money a renewal brings in. Each writes only the licence on the deal, so
// these are safe to fire from a row in a list rather than from a form.

export type UsageResult = { success: true } | { success: false; error: string };

function usageFailure(err: unknown, fallback: string): UsageResult {
  return { success: false, error: err instanceof Error ? err.message : fallback };
}

// Every one of these moves money or a licence that the earnings breakdown,
// the brand CRM and the campaigns table all read, so they revalidate the same
// set a payment does rather than campaigns alone.
function revalidateUsagePaths(): void {
  revalidateStores("campaigns", "brands");
}

async function recordUsageEvent(
  action: ActivityAction,
  record: CampaignRecord,
  detail?: string,
  amount?: number
): Promise<void> {
  await recordActivity({
    action,
    entity: {
      type: "campaign",
      id: record.id,
      label: campaignLabel(record.campaign, record.brand),
    },
    detail: detail || record.brand.trim() || undefined,
    ...(amount === undefined ? {} : { amount }),
  });
}

const USAGE_EVENTS: Record<UsageTransition, ActivityAction> = {
  pause: "campaign.usage_paused",
  resume: "campaign.usage_resumed",
  end: "campaign.usage_ended",
};

/**
 * Freezes a licence's countdown, restarts a frozen one, or calls it off.
 *
 * "resume" is the Undo for both of the others: it un-pauses and it un-ends,
 * which is what lets the card offer a single reversal for either. The days a
 * licence spent paused are banked on the way out, so a pause and an immediate
 * undo costs the term nothing.
 */
export async function setCampaignUsageState(
  campaignId: string,
  transition: UsageTransition
): Promise<UsageResult> {
  if (!campaignId.trim()) {
    return { success: false, error: "This deal has no campaign ID to update" };
  }
  try {
    const change = await campaignRepository.setUsageState(campaignId, transition);
    if (!change) return { success: false, error: "That campaign no longer exists" };
    revalidateUsagePaths();
    await recordUsageEvent(USAGE_EVENTS[transition], change.after);
    return { success: true };
  } catch (err) {
    return usageFailure(err, "Couldn't update the usage rights");
  }
}

export interface RenewResult {
  success: true;
  /** The number of the invoice raised, e.g. "0012". Null when none was. */
  invoiceNo: string | null;
  /** Set when the renewal was saved but its invoice could not be raised. */
  warning?: string;
}

/**
 * Raises the invoice that bills for a renewal, and points the renewal at it.
 *
 * Run after the renewal is written, and reported separately, for the same
 * reason syncLinkedInvoiceStatus is: the renewal is what the creator asked
 * for, and it should stand even when the second store cannot be reached. A
 * renewal missing its invoice is fixed by raising one by hand; a renewal
 * rolled back because an invoice failed is just lost work.
 *
 * Answers the invoice number it raised, or null when there was nothing to
 * bill: a licence extended for free is not a sale, and an invoice for zero is
 * a document with nothing to collect on.
 */
interface RenewalBilling {
  months: number;
  amount: number;
  startDate: string; // yyyy-mm-dd
  paymentDue: string; // yyyy-mm-dd, "" when none was agreed
  paid: boolean;
}

async function raiseRenewalInvoice(
  campaign: CampaignRecord,
  renewalId: string,
  billing: RenewalBilling
): Promise<string | null> {
  if (billing.amount <= 0) return null;

  const [defaults, existing, brands, contacts] = await Promise.all([
    getInvoiceData(),
    getInvoices(),
    getBrands(),
    getContacts(),
  ]);

  const brand = campaign.brandId
    ? (brands.find((entry) => entry.id === campaign.brandId) ?? null)
    : null;

  const record = await addInvoice(
    buildRenewalInvoice({
      defaults,
      existing,
      brandName: campaign.brand,
      brandId: campaign.brandId,
      contactName: brand ? (primaryContactForBrand(brand, contacts)?.name ?? "") : "",
      campaignName: campaign.campaign,
      months: billing.months,
      amount: billing.amount,
      startDate: billing.startDate,
      dueDate: billing.paymentDue,
      paid: billing.paid,
      today: todayISO(),
    })
  );

  await campaignRepository.linkRenewalInvoice(campaign.id, renewalId, record.id);

  // Logged like any other invoice: it is a document that now exists and can be
  // sent, and a log that records the ones typed by hand but not the ones the
  // app raised is a log that cannot be trusted to be complete.
  await recordActivity({
    action: "invoice.created",
    entity: { type: "invoice", id: record.id, label: buildInvoiceNumber(record.invoiceNo) },
    detail: record.client.name || undefined,
    amount: computeSubtotal(record.items),
  });

  // The invoice editor seeds its number field from invoiceNumberSeed alone,
  // and only bumps it when an invoice is saved through the editor. This wrote
  // one without going near it, so the seed is advanced here too: without it,
  // the next invoice raised by hand would open on the number just used.
  //
  // In its own try because it is housekeeping: the invoice is already saved,
  // and a stale seed shows a duplicate number in a form the creator can still
  // correct, which is not worth reporting a failed renewal over.
  try {
    await saveInvoiceData({
      ...defaults,
      invoiceNumberSeed: nextInvoiceNo(
        [...existing, { invoiceNo: record.invoiceNo }],
        defaults.invoiceNumberSeed
      ),
    });
  } catch {
    // keep the invoice; the seed catches up on the next editor save
  }

  return record.invoiceNo;
}

/**
 * Extends the licence by another term, records what the brand paid for it, and
 * raises the invoice that bills for it.
 *
 * Deliberately not undoable from the toast: a renewal is a commercial record
 * with its own payment status and now its own invoice, and silently deleting
 * one to reverse a misclick would take both with it. It is edited on the deal
 * instead.
 */
export async function renewCampaignUsage(
  campaignId: string,
  input: UsageRenewalFormValues
): Promise<RenewResult | { success: false; error: string }> {
  if (!campaignId.trim()) {
    return { success: false, error: "This deal has no campaign ID to update" };
  }
  if (input.months <= 0) {
    return { success: false, error: "A renewal needs a term of at least one month" };
  }
  try {
    const change = await campaignRepository.renewUsage(campaignId, input);
    if (!change) return { success: false, error: "That campaign no longer exists" };

    const renewals = change.after.usage?.renewals ?? [];
    const renewal = renewals[renewals.length - 1];

    // Outside the write above, and after it: the renewal is already recorded,
    // so a failure here is reported as a warning rather than rolling it back.
    let invoiceNo: string | null = null;
    let warning: string | undefined;
    try {
      if (renewal) {
        invoiceNo = await raiseRenewalInvoice(change.after, renewal.id, {
          months: input.months,
          amount: input.amount,
          startDate: input.startDate,
          paymentDue: input.paymentDue,
          paid: input.paymentStatus === "received",
        });
      }
    } catch (err) {
      warning = err instanceof Error ? err.message : "The invoice wasn't raised";
    }

    // Revalidated once, after both writes, so the invoices list shows the new
    // document on the same navigation that shows the renewal.
    revalidateUsagePaths();
    revalidateStores("invoices", "invoiceDefaults");

    await recordUsageEvent(
      "campaign.usage_renewed",
      change.after,
      `${input.months} more month${input.months === 1 ? "" : "s"}`,
      renewal?.amount
    );
    return { success: true, invoiceNo, ...(warning ? { warning } : {}) };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Couldn't record the renewal",
    };
  }
}

/** Collects one renewal's money, or puts it back to pending (the toast's Undo). */
export async function setUsageRenewalPaymentStatus(
  campaignId: string,
  renewalId: string,
  status: CampaignPaymentStatus
): Promise<UsageResult> {
  if (!campaignId.trim() || !renewalId.trim()) {
    return { success: false, error: "This renewal has no ID to update" };
  }
  try {
    const change = await campaignRepository.setRenewalPaymentStatus(campaignId, renewalId, status);
    if (!change) return { success: false, error: "That renewal no longer exists" };

    const renewal = (change.after.usage?.renewals ?? []).find((entry) => entry.id === renewalId);

    // Keep the renewal's own invoice in step, the way collecting on a deal
    // moves the invoice it references. Without this a renewal reads "received"
    // while the document billing for it still says draft, which is exactly the
    // drift invoicePaymentMismatch exists to complain about.
    //
    // Outside the write above and swallowed on failure, like
    // syncLinkedInvoiceStatus: the money is already recorded, and an invoice
    // that could not be re-stamped is not worth failing a collected payment
    // over. Reverting puts the invoice back to a draft rather than to "sent",
    // since an auto-raised one was never sent in the first place.
    if (renewal?.invoiceId) {
      try {
        const invoice = (await getInvoices()).find((entry) => entry.id === renewal.invoiceId);
        if (invoice && invoice.status !== "void") {
          const target = status === "received" ? "paid" : "draft";
          if (invoice.status !== target) await setInvoiceStatus(invoice.id, target);
        }
      } catch {
        // the payment stands; the invoice catches up when it is next edited
      }
    }

    revalidateUsagePaths();
    revalidateStores("invoices");

    await recordUsageEvent(
      status === "received"
        ? "campaign.usage_payment_received"
        : "campaign.usage_payment_reverted",
      change.after,
      "usage renewal",
      renewal?.amount
    );
    return { success: true };
  } catch (err) {
    return usageFailure(err, "Couldn't update the renewal payment");
  }
}

/**
 * Raises the invoice for a renewal that has none.
 *
 * Two renewals need this. One recorded before renewing raised an invoice at
 * all, and one whose invoice failed to save at the moment it was recorded:
 * that second case was already reported as a warning, and until now the only
 * way out of it was to retype the whole document into the editor. It is the
 * same write either way, replayed from what the renewal already stores.
 *
 * Refuses when one already exists rather than raising a second: a duplicate
 * invoice for money that was only owed once is worse than none at all, and
 * the link on the renewal is the record of which it was.
 */
export async function raiseInvoiceForRenewal(
  campaignId: string,
  renewalId: string
): Promise<RenewResult | { success: false; error: string }> {
  if (!campaignId.trim() || !renewalId.trim()) {
    return { success: false, error: "This renewal has no ID to bill for" };
  }
  try {
    const campaigns = await campaignRepository.getAll();
    const campaign = campaigns.find((entry) => entry.id === campaignId);
    if (!campaign) return { success: false, error: "That campaign no longer exists" };

    const renewal = campaign.usage.renewals.find((entry) => entry.id === renewalId);
    if (!renewal) return { success: false, error: "That renewal no longer exists" };
    if (renewal.invoiceId) {
      return { success: false, error: "This renewal already has an invoice" };
    }
    if (renewal.amount <= 0) {
      return { success: false, error: "Nothing was charged for this renewal" };
    }

    const invoiceNo = await raiseRenewalInvoice(campaign, renewal.id, {
      months: renewal.months,
      amount: renewal.amount,
      // Stored DD/MM/YYYY; the builder works in the yyyy-mm-dd the invoice
      // record keeps its dates in.
      startDate: toIsoDate(renewal.startDate),
      paymentDue: toIsoDate(renewal.paymentDue),
      paid: renewal.paymentStatus === "received",
    });

    revalidateUsagePaths();
    revalidateStores("invoices", "invoiceDefaults");
    return { success: true, invoiceNo };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Couldn't raise the invoice",
    };
  }
}
