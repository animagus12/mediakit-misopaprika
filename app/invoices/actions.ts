"use server";

import { revalidateStores } from "@/lib/revalidation";
import { saveInvoiceData } from "@/repositories/invoice.writer.server";
import {
  addInvoice,
  deleteInvoice,
  updateInvoice as updateInvoiceRecord,
} from "@/repositories/invoices.writer.server";
import { campaignRepository } from "@/repositories/campaignRepository";
import {
  buildInvoiceNumber,
  computeSubtotal,
  findInvoiceByCampaignRef,
  paymentStatusForInvoice,
} from "@/lib/invoice";
import { recordActivity } from "@/repositories/activity.writer.server";
import { describeChanges } from "@/lib/activityDiff";
import { invoiceFields } from "@/lib/activityFields";
import type { InvoiceData } from "@/repositories/invoice";
import type { InvoiceStatus, InvoiceUpdate, NewInvoice } from "@/repositories/invoices";

type ActionResult = { success: true } | { success: false; error: string };

function toActionError(err: unknown, fallback: string): { success: false; error: string } {
  return { success: false, error: err instanceof Error ? err.message : fallback };
}

/**
 * The mirror of syncLinkedInvoiceStatus in app/(dashboard)/actions.ts: moving
 * an invoice to "paid" in the editor marks the deal it bills for as received,
 * and moving it back off "paid" returns the deal to pending. Saving an
 * invoice is also where the deal's invoiceId foreign key gets written, since
 * it is the moment both records exist and are known to be the same billing.
 *
 * Without this the two records drift in the opposite direction from the
 * dashboard bug: the invoice reads Paid while "Payments due" still lists the
 * deal and Earnings still counts it as outstanding, because every one of
 * those is computed from Campaign.paymentStatus alone (see selectDuePayments).
 *
 * What the deal moves to is paymentStatusForInvoice's call: a "Not tracked"
 * deal follows its invoice too, and a called-off one never does.
 */
async function syncLinkedCampaignPayment(
  invoiceId: string,
  invoiceNo: string,
  status: InvoiceStatus,
  campaignId?: string
): Promise<void> {
  const campaigns = await campaignRepository.getAll();
  // A renewal's invoice bills a licence extension, not the deal: its link and
  // its payment live on the renewal (see setUsageRenewalPaymentStatus).
  if (campaigns.some((entry) => entry.usage.renewals.some((renewal) => renewal.invoiceId === invoiceId))) {
    return;
  }
  // The deal the invoice was raised from, when it was, since that is known
  // rather than inferred. Then by key, so a deal already reconciled keeps its
  // invoice even after that invoice is renumbered; by the typed reference
  // otherwise, which is the only handle a deal that predates the link has, and
  // only on a deal no other invoice bills yet: matching a linked deal by number
  // is how one deal's invoice was once stolen by another quoting the same one.
  const campaign =
    (campaignId ? campaigns.find((entry) => entry.id === campaignId) : undefined) ??
    campaigns.find((entry) => entry.invoiceId === invoiceId) ??
    campaigns.find(
      (entry) => !entry.invoiceId && findInvoiceByCampaignRef(entry.invoiceRef, [{ invoiceNo }])
    );
  if (!campaign) return;

  // Written before the status check below, and regardless of what that status
  // is: saving the invoice is the one moment the app knows which record the
  // typed reference meant, and a draft names its deal just as well as a paid
  // one does. The deal's reference follows the invoice's number, so raising it
  // under another number or renumbering it later leaves no stale reference on
  // the campaigns table. A no-op when both already agree.
  await campaignRepository.linkInvoice(campaign.id, invoiceId, invoiceNo);

  const target = paymentStatusForInvoice(campaign, status);
  if (!target) return;

  // Through the repository rather than the writer, so this collects a payment
  // the same way the dashboard's "Mark received" does: stamping the day the
  // money landed, and clearing it again when an invoice comes back off "paid".
  if (target === "received") await campaignRepository.setPaymentReceived(campaign.id);
  else await campaignRepository.setPaymentPending(campaign.id);
}

export async function saveInvoiceDefaults(data: InvoiceData): Promise<ActionResult> {
  try {
    await saveInvoiceData(data);
    revalidateStores("invoiceDefaults");
    return { success: true };
  } catch {
    return { success: false, error: "Couldn't save: check KV_REST_API_URL and KV_REST_API_TOKEN are set" };
  }
}

/**
 * `campaignId` is the deal the editor was prefilled from, when it was: the
 * invoice is linked to that deal directly, even when its number differs from
 * the reference the deal quotes.
 */
export async function createInvoice(
  input: NewInvoice,
  campaignId?: string
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  try {
    const record = await addInvoice(input);
    // An invoice can be raised already marked paid against a deal that already
    // references its number, so creation syncs the same way an edit does.
    try {
      await syncLinkedCampaignPayment(record.id, record.invoiceNo, record.status, campaignId);
    } catch {
      // The invoice is saved; the deal not following is not worth failing on.
    }
    revalidateStores("invoices", "campaigns");
    await recordActivity({
      action: "invoice.created",
      entity: { type: "invoice", id: record.id, label: buildInvoiceNumber(record.invoiceNo) },
      detail: record.client.name || undefined,
      amount: computeSubtotal(record.items),
    });
    return { success: true, id: record.id };
  } catch (err) {
    return toActionError(err, "Couldn't save the invoice");
  }
}

export async function updateInvoice(input: InvoiceUpdate): Promise<ActionResult> {
  try {
    const change = await updateInvoiceRecord(input);
    // Outside the write above for the same reason as the dashboard's mark
    // received: the invoice edit stands even if the deal couldn't follow.
    try {
      await syncLinkedCampaignPayment(input.id, input.invoiceNo, input.status);
    } catch {
      // Reported through the pages below rather than failing a saved invoice.
    }
    revalidateStores("invoices", "campaigns");
    if (change) {
      // Collecting on an invoice is the event worth finding later, so it is
      // logged as its own action rather than as another edit: but only on the
      // crossing into paid, or re-saving a paid invoice would log it again.
      const collected = change.after.status === "paid" && change.before.status !== "paid";
      await recordActivity({
        action: collected ? "invoice.paid" : "invoice.updated",
        entity: {
          type: "invoice",
          id: change.after.id,
          label: buildInvoiceNumber(change.after.invoiceNo),
        },
        // On the crossing into paid the client is the useful context; on an
        // ordinary edit, what moved is.
        detail: collected
          ? change.after.client.name || undefined
          : describeChanges(change, invoiceFields) ?? (change.after.client.name || undefined),
        amount: computeSubtotal(change.after.items),
      });
    }
    return { success: true };
  } catch (err) {
    return toActionError(err, "Couldn't save the invoice");
  }
}

export async function removeInvoice(id: string): Promise<ActionResult> {
  try {
    const removed = await deleteInvoice(id);
    // A deal pointing at an invoice that no longer exists would resolve to
    // nothing on every read; clearing the key returns it to its typed
    // reference, which is where it was before the invoice was raised.
    if (removed) {
      const linked = (await campaignRepository.getAll()).find(
        (campaign) => campaign.invoiceId === removed.id
      );
      if (linked) await campaignRepository.linkInvoice(linked.id, "");
    }
    revalidateStores("invoices", "campaigns");
    if (removed) {
      await recordActivity({
        action: "invoice.deleted",
        entity: { type: "invoice", id: removed.id, label: buildInvoiceNumber(removed.invoiceNo) },
        detail: removed.client.name || undefined,
        amount: computeSubtotal(removed.items),
      });
    }
    return { success: true };
  } catch (err) {
    return toActionError(err, "Couldn't remove the invoice");
  }
}
