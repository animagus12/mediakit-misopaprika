"use server";

import { revalidateStores } from "@/lib/revalidation";
import { recordActivity } from "@/repositories/activity.writer.server";
import { describeChanges } from "@/lib/activityDiff";
import { campaignFields } from "@/lib/activityFields";
import { campaignRepository } from "@/repositories/campaignRepository";
import type {
  CampaignFormUpdate,
  CampaignFormValues,
  CampaignRecord,
  CampaignStatus,
  UsageRenewalFormValues,
  UsageRenewalTdsValues,
  UsageTransition,
} from "@/repositories/campaignRepository";
import type { ActivityAction } from "@/repositories/activity";
import { getBrands, addBrand } from "@/repositories/brands.writer.server";
import { markCampaignPaymentExpected, readCampaignLedger } from "@/repositories/campaigns.writer.server";
import { addInvoice, clearInvoiceLegacyPayment, getInvoices } from "@/repositories/invoices.writer.server";
import { getInvoiceData, saveInvoiceData } from "@/repositories/invoice.writer.server";
import { getContacts } from "@/repositories/contacts.writer.server";
import { newPaymentId, paymentActivity, recordTargetPayment } from "@/repositories/paymentLedger.server";
import { samePaymentTarget, type PaymentInput, type PaymentTarget } from "@/repositories/payments";
import { insertPayments, retargetPayments } from "@/repositories/payments.writer.server";
import { primaryContactForBrand } from "@/lib/contacts";
import { buildRenewalInvoice, nextInvoiceNo } from "@/lib/usageInvoice";
import { formatUsageDays, usageEndDateProblem } from "@/lib/usageRights";
import { buildInvoiceNumber, computeSubtotal, reservedInvoiceNumbers, todayISO } from "@/lib/invoice";
import { campaignTypeHasCash, toCampaign } from "@/repositories/campaigns";
import { normalizeBrandName } from "@/lib/brandCampaignStats";
import { campaignLabel, isCampaignStatus, toIsoDate, toSheetDate } from "@/lib/campaigns";
import { validateTdsValues } from "@/lib/tds";
import { requireSession } from "@/lib/session.server";

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
//
// `brand` is the name the deal should show. A linked deal shows its brand's
// own name, so the campaigns table and the brand page never disagree about
// what a brand is called ("Crosswords" on a deal linked to "Crossword
// Bookstore"). A link to a brand that no longer exists is dropped and resolved
// again from the typed name, rather than saved pointing at nothing.
async function resolveOrCreateBrandId(
  brandId: string | null,
  brandName: string,
  campaignStatus: CampaignStatus
): Promise<{ brandId: string | null; brand: string; createdBrand: CreatedBrand | null }> {
  const name = brandName.trim();
  if (!brandId && !name) return { brandId: null, brand: name, createdBrand: null };

  const brands = await getBrands();
  const linked = brandId ? brands.find((brand) => brand.id === brandId) : undefined;
  if (linked) return { brandId: linked.id, brand: linked.name, createdBrand: null };
  if (!name) return { brandId: null, brand: name, createdBrand: null };

  const key = normalizeBrandName(name);
  const existing = brands.find((brand) => normalizeBrandName(brand.name) === key);
  if (existing) return { brandId: existing.id, brand: existing.name, createdBrand: null };

  // A freshly-created brand is "Active" by default; only a campaign added as
  // already Posted implies a finished collaboration ("Worked With").
  const status = campaignStatus === "Posted" ? "Worked With" : "Active";
  const created = await addBrand({
    name,
    logoUrl: null,
    website: "",
    instagram: "",
    agencyId: null,
    primaryContactId: null,
    status,
  });
  return { brandId: created.id, brand: created.name, createdBrand: { id: created.id, name: created.name } };
}

/**
 * Links a deal to the invoice picked for it in the edit sheet, or unlinks it
 * with null. A no-op when the deal already holds exactly that link.
 *
 * Picked, never inferred: every guess from typed numbers has at some point
 * matched the wrong deal. One invoice bills one deal, so an invoice another
 * deal holds is refused rather than moved: the picker never offers one, and a
 * sheet opened before that link was made should not silently undo it. The
 * link is freed by unlinking it on the deal that holds it.
 *
 * Unlinking also blanks the deal's reference (see setCampaignInvoice), or the
 * deal would go on resolving to that invoice by number and read as invoiced.
 * Linking sets the reference to the invoice's number.
 *
 * Money follows the link, since a linked invoice is paid by its deal (see
 * lib/payments.ts): payments recorded on the invoice while it stood alone move
 * to the deal, unless the deal has its own, which would count the money twice
 * and is refused. A "Not tracked" deal takes the invoice's answer: an invoice
 * marked paid becomes a payment on the deal, a sent one makes the money
 * expected. Unlinking leaves every payment with the deal.
 */
async function applyInvoiceLink(campaignId: string, invoiceId: string | null): Promise<void> {
  const [ledger, invoices] = await Promise.all([readCampaignLedger(), getInvoices()]);
  const deal = ledger.campaigns.find((entry) => entry.id === campaignId);
  if (!deal || deal.invoiceId === invoiceId) return;

  if (!invoiceId) {
    await campaignRepository.linkInvoice(deal.id, "");
    return;
  }
  const invoice = invoices.find((entry) => entry.id === invoiceId);
  if (!invoice) throw new Error("The picked invoice no longer exists");
  if (ledger.campaigns.some((entry) => entry.id !== deal.id && entry.invoiceId === invoice.id)) {
    throw new Error(`${buildInvoiceNumber(invoice.invoiceNo)} is already linked to another campaign`);
  }

  const invoiceTarget: PaymentTarget = { kind: "invoice", invoiceId: invoice.id };
  const dealTarget: PaymentTarget = { kind: "deal", campaignId: deal.id };
  const invoicePayments = ledger.payments.filter((payment) => samePaymentTarget(payment.target, invoiceTarget));
  const dealHasPayments =
    deal.storedPaymentStatus === "received" ||
    ledger.payments.some((payment) => samePaymentTarget(payment.target, dealTarget));
  if (invoicePayments.length > 0 && dealHasPayments) {
    throw new Error("Both this deal and the invoice have payments recorded. Delete one set first.");
  }

  await campaignRepository.linkInvoice(deal.id, invoice.id, buildInvoiceNumber(invoice.invoiceNo));

  if (invoicePayments.length > 0) {
    await retargetPayments(invoiceTarget, dealTarget);
    return;
  }
  if (deal.storedPaymentStatus !== "unknown" || !campaignTypeHasCash(deal.type) || deal.cash <= 0) return;
  if (invoice.storedStatus === "paid") {
    await insertPayments([
      {
        id: newPaymentId(),
        target: dealTarget,
        date: "",
        gross: deal.cash,
        tds: 0,
        bankFee: 0,
        receivedInto: null,
        method: null,
        reference: "",
        note: `Marked paid on ${buildInvoiceNumber(invoice.invoiceNo)} before it was linked`,
        origin: "legacy",
        createdAt: "",
        updatedAt: "",
      },
    ]);
    await clearInvoiceLegacyPayment(invoice.id, { paid: true, advance: true });
  } else if (invoice.storedStatus === "sent") {
    await markCampaignPaymentExpected(deal.id);
  }
}

/**
 * Unlinks a deal from its invoice straight away: the edit sheet's unlink icon,
 * for a link that is simply wrong. Neither record is deleted; the invoice goes
 * back to being pickable for the deal it actually bills.
 */
export async function unlinkCampaignInvoice(
  campaignId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const denied = await requireSession();
  if (denied) return denied;

  if (!campaignId.trim()) return { success: false, error: "This deal has no campaign ID to update" };
  try {
    const [campaigns, invoices] = await Promise.all([campaignRepository.getAll(), getInvoices()]);
    const deal = campaigns.find((entry) => entry.id === campaignId);
    if (!deal) return { success: false, error: "That campaign no longer exists" };
    const invoice = invoices.find((entry) => entry.id === deal.invoiceId);

    await applyInvoiceLink(campaignId, null);
    revalidateCampaignPaths();
    revalidateStores("invoices");
    await recordActivity({
      action: "campaign.updated",
      entity: { type: "campaign", id: deal.id, label: campaignLabel(deal.campaign, deal.brand) },
      detail: invoice ? `unlinked invoice ${buildInvoiceNumber(invoice.invoiceNo)}` : "unlinked invoice",
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Couldn't unlink the invoice" };
  }
}

/**
 * Links a standalone invoice to the deal it bills, from the invoice's page:
 * asked before its first payment, so money for a deal is recorded on that
 * deal (see applyInvoiceLink for what moves with the link).
 */
export async function linkInvoiceToCampaign(
  invoiceId: string,
  campaignId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const denied = await requireSession();
  if (denied) return denied;

  try {
    const [campaigns, invoices] = await Promise.all([campaignRepository.getAll(), getInvoices()]);
    const deal = campaigns.find((entry) => entry.id === campaignId);
    if (!deal) return { success: false, error: "That campaign no longer exists" };
    if (deal.invoiceId) return { success: false, error: "That campaign already has an invoice" };
    const invoice = invoices.find((entry) => entry.id === invoiceId);
    if (!invoice) return { success: false, error: "That invoice no longer exists" };

    await applyInvoiceLink(campaignId, invoiceId);
    revalidateCampaignPaths();
    revalidateStores("invoices", "payments");
    await recordActivity({
      action: "campaign.updated",
      entity: { type: "campaign", id: deal.id, label: campaignLabel(deal.campaign, deal.brand) },
      detail: `linked invoice ${buildInvoiceNumber(invoice.invoiceNo)}`,
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Couldn't link the invoice" };
  }
}

function revalidateCampaignPaths(): void {
  // A campaign write can also create a brand (see resolveOrCreateBrandId).
  revalidateStores("campaigns", "brands");
}

/**
 * Records a payment made before its deal or renewal was entered (the forms'
 * "Already received"), after that record is saved. Answers a sentence to warn
 * with when it could not be recorded, so the record still stands.
 */
async function recordReceived(input: PaymentInput): Promise<string | null> {
  try {
    const { result, ctx, warning } = await recordTargetPayment(input);
    revalidateStores("payments");
    await recordActivity({ action: "payment.recorded", ...paymentActivity(result, ctx) });
    return warning ?? null;
  } catch (err) {
    return `The payment wasn't recorded: ${err instanceof Error ? err.message : "try again from Payments"}`;
  }
}

export async function createCampaign(
  input: CampaignFormValues,
  received?: Omit<PaymentInput, "target">
): Promise<
  { success: true; createdBrand: CreatedBrand | null; warning?: string } | { success: false; error: string }
> {
  const denied = await requireSession();
  if (denied) return denied;

  if (!isCampaignStatus(input.status)) return { success: false, error: "Pick a status" };
  const tdsProblem = validateTdsValues(input.tdsRate, input.tdsAmount);
  if (tdsProblem) return { success: false, error: tdsProblem };
  try {
    const { brandId, brand, createdBrand } = await resolveOrCreateBrandId(input.brandId, input.brand, input.status);
    const record = await campaignRepository.create({ ...input, brandId, brand });
    revalidateCampaignPaths();
    await recordActivity({
      action: "campaign.created",
      entity: { type: "campaign", id: record.id, label: campaignLabel(input.campaign, brand) },
      detail: brand || undefined,
      amount: input.amount + (input.usageFee ?? 0) + input.barterValue,
    });
    const warning =
      received && campaignTypeHasCash(record.type)
        ? await recordReceived({ ...received, target: { kind: "deal", campaignId: record.id } })
        : null;
    return { success: true, createdBrand, ...(warning ? { warning } : {}) };
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
  const denied = await requireSession();
  if (denied) return denied;

  if (!isCampaignStatus(input.status)) return { success: false, error: "Pick a status" };
  const tdsProblem = validateTdsValues(input.tdsRate, input.tdsAmount);
  if (tdsProblem) return { success: false, error: tdsProblem };
  // Checked against the upload and deal dates in this same submission, so a
  // form that moves both at once is judged on what it will save.
  if (input.usageEndedOn !== undefined) {
    const problem = usageEndDateProblem(
      { uploadDate: toSheetDate(input.uploadDate ?? ""), date: toSheetDate(input.date) },
      input.usageEndedOn
    );
    if (problem) return { success: false, error: problem };
  }
  try {
    const { brandId, brand, createdBrand } = await resolveOrCreateBrandId(input.brandId, input.brand, input.status);
    const change = await campaignRepository.update({ ...input, brandId, brand });
    // After the deal's own write, so the reference the link sets is not
    // overwritten by the one the form sent. Its failure is reported, since the
    // creator picked that invoice and would otherwise think it was linked.
    let linkError: string | null = null;
    if (change && input.invoiceId !== undefined) {
      try {
        await applyInvoiceLink(change.after.id, input.invoiceId);
      } catch (err) {
        linkError = err instanceof Error ? err.message : "The invoice link wasn't saved";
      }
    }
    revalidateCampaignPaths();
    revalidateStores("invoices");
    if (linkError) return { success: false, error: `Campaign saved, but ${linkError.toLowerCase()}` };
    if (change) {
      await recordActivity({
        action: "campaign.updated",
        entity: {
          type: "campaign",
          id: change.after.id,
          label: campaignLabel(change.after.campaign, change.after.brand),
        },
        detail: describeChanges(change, campaignFields) ?? (change.after.brand.trim() || undefined),
        amount: toCampaign(change.after).total,
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
 * Moves a deal to another pipeline status, and only that: the dashboard's
 * quick status control and its Undo. Everything else on the deal, its
 * editing job and payment fields included, is left as stored.
 */
export async function setCampaignWorkflowStatus(
  id: string,
  status: CampaignStatus
): Promise<{ success: true } | { success: false; error: string }> {
  const denied = await requireSession();
  if (denied) return denied;

  if (!isCampaignStatus(status)) return { success: false, error: "Pick a status" };
  try {
    const change = await campaignRepository.setStatus(id, status);
    if (!change) return { success: false, error: "This campaign no longer exists" };
    if (change.before === change.after) return { success: true };
    revalidateStores("campaigns");
    await recordActivity({
      action: "campaign.updated",
      entity: {
        type: "campaign",
        id: change.after.id,
        label: campaignLabel(change.after.campaign, change.after.brand),
      },
      detail: describeChanges(change, campaignFields) ?? (change.after.brand.trim() || undefined),
      amount: toCampaign(change.after).total,
    });
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Couldn't update the status",
    };
  }
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
  const denied = await requireSession();
  if (denied) return denied;

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
 * reason a payment recorded with it is: the renewal is what the creator asked
 * for, and it should stand even when the second store cannot be reached. A
 * renewal missing its invoice is fixed by raising one by hand; a renewal
 * rolled back because an invoice failed is just lost work.
 *
 * Answers the invoice number it raised, or null when there was nothing to
 * bill: a licence extended for free is not a sale, and an invoice for zero is
 * a document with nothing to collect on.
 */
interface RenewalBilling {
  days: number;
  amount: number;
  startDate: string; // yyyy-mm-dd
  paymentDue: string; // yyyy-mm-dd, "" when none was agreed
}

async function raiseRenewalInvoice(
  campaign: CampaignRecord,
  renewalId: string,
  billing: RenewalBilling
): Promise<string | null> {
  if (billing.amount <= 0) return null;

  const [defaults, invoices, campaigns, brands, contacts] = await Promise.all([
    getInvoiceData(),
    getInvoices(),
    campaignRepository.getAll(),
    getBrands(),
    getContacts(),
  ]);
  // Numbers deals quote count as used: this is how a renewal was once raised
  // as 0012 while another deal already quoted MSP-INV-0012.
  const existing = reservedInvoiceNumbers(invoices, campaigns);

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
      days: billing.days,
      amount: billing.amount,
      startDate: billing.startDate,
      dueDate: billing.paymentDue,
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
 * Extends the licence by another term, raises the invoice that bills for it,
 * and, when `received` is given, records the payment the brand already made
 * for it.
 *
 * Deliberately not undoable from the toast: a renewal is a commercial record
 * with its own payments and now its own invoice, and silently deleting one to
 * reverse a misclick would take both with it. It is edited on the deal
 * instead.
 */
export async function renewCampaignUsage(
  campaignId: string,
  input: UsageRenewalFormValues,
  received?: Omit<PaymentInput, "target">
): Promise<RenewResult | { success: false; error: string }> {
  const denied = await requireSession();
  if (denied) return denied;

  if (!campaignId.trim()) {
    return { success: false, error: "This deal has no campaign ID to update" };
  }
  if (input.days <= 0) {
    return { success: false, error: "A renewal needs a term of at least one day" };
  }
  const tdsProblem = validateTdsValues(input.tdsRate, null);
  if (tdsProblem) return { success: false, error: tdsProblem };
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
          days: input.days,
          amount: input.amount,
          startDate: input.startDate,
          paymentDue: input.paymentDue,
        });
      }
    } catch (err) {
      warning = err instanceof Error ? err.message : "The invoice wasn't raised";
    }

    // After the renewal and its invoice, and reported the same way: the
    // renewal stands even when its payment could not be recorded.
    if (renewal && received) {
      const problem = await recordReceived({
        ...received,
        target: { kind: "renewal", campaignId: change.after.id, renewalId: renewal.id },
      });
      if (problem) warning = warning ? `${warning}. ${problem}` : problem;
    }

    // Revalidated once, after both writes, so the invoices list shows the new
    // document on the same navigation that shows the renewal.
    revalidateUsagePaths();
    revalidateStores("invoices", "invoiceDefaults", "payments");

    await recordUsageEvent(
      "campaign.usage_renewed",
      change.after,
      `${formatUsageDays(input.days)} more`,
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

/**
 * Sets the TDS rate one renewal's brand is expected to withhold, or clears it
 * with null. What was actually withheld is recorded on each payment.
 *
 * Its own action because the rest of a renewal is fixed once recorded (see
 * UsageRightsPanel), while the rate is often only known after the first
 * payment lands.
 */
export async function setUsageRenewalTds(
  campaignId: string,
  renewalId: string,
  input: UsageRenewalTdsValues
): Promise<UsageResult> {
  const denied = await requireSession();
  if (denied) return denied;

  if (!campaignId.trim() || !renewalId.trim()) {
    return { success: false, error: "This renewal has no ID to update" };
  }
  const tdsProblem = validateTdsValues(input.tdsRate, null);
  if (tdsProblem) return { success: false, error: tdsProblem };
  try {
    const change = await campaignRepository.setRenewalTds(campaignId, renewalId, { tdsRate: input.tdsRate });
    if (!change) return { success: false, error: "That renewal no longer exists" };
    revalidateUsagePaths();
    await recordUsageEvent("campaign.updated", change.after, "renewal TDS");
    return { success: true };
  } catch (err) {
    return usageFailure(err, "Couldn't save the renewal TDS");
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
/**
 * Detaches a renewal from the invoice it points at, for a link that is wrong:
 * typically an auto-raised renewal invoice later edited into a different
 * deal's invoice, which leaves the renewal claiming a document that no longer
 * bills it. Nothing is deleted. The invoice becomes linkable to its real deal
 * again, and the renewal gets its "Raise invoice" action back.
 */
export async function unlinkRenewalInvoice(
  campaignId: string,
  renewalId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const denied = await requireSession();
  if (denied) return denied;

  if (!campaignId.trim() || !renewalId.trim()) {
    return { success: false, error: "This renewal has no ID to update" };
  }
  try {
    const record = await campaignRepository.linkRenewalInvoice(campaignId, renewalId, "");
    if (!record) return { success: false, error: "That renewal no longer exists" };
    revalidateUsagePaths();
    revalidateStores("invoices");
    await recordUsageEvent("campaign.updated", record, "unlinked renewal invoice");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Couldn't unlink the invoice" };
  }
}

export async function raiseInvoiceForRenewal(
  campaignId: string,
  renewalId: string
): Promise<RenewResult | { success: false; error: string }> {
  const denied = await requireSession();
  if (denied) return denied;

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
      days: renewal.days,
      amount: renewal.amount,
      // Stored DD/MM/YYYY; the builder works in the yyyy-mm-dd the invoice
      // record keeps its dates in.
      startDate: toIsoDate(renewal.startDate),
      paymentDue: toIsoDate(renewal.paymentDue),
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
