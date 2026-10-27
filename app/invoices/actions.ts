"use server";

import { revalidateStores } from "@/lib/revalidation";
import { saveInvoiceData } from "@/repositories/invoice.writer.server";
import {
  addInvoice,
  deleteInvoice,
  updateInvoice as updateInvoiceRecord,
} from "@/repositories/invoices.writer.server";
import { campaignRepository } from "@/repositories/campaignRepository";
import { buildInvoiceNumber, computeSubtotal, findInvoiceByCampaignRef, invoiceOwner } from "@/lib/invoice";
import { recordActivity } from "@/repositories/activity.writer.server";
import { describeChanges } from "@/lib/activityDiff";
import { invoiceFields } from "@/lib/activityFields";
import type { InvoiceData } from "@/repositories/invoice";
import type { InvoiceRecord, InvoiceUpdate, NewInvoice } from "@/repositories/invoices";
import { readInvoiceRecords } from "@/repositories/invoiceRecords.server";
import { addTrashEntry, activateTrashEntry, removeTrashEntry } from "@/repositories/trash.writer.server";
import { requireSession } from "@/lib/session.server";

type ActionResult = { success: true; trashId?: string } | { success: false; error: string };

function toActionError(err: unknown, fallback: string): { success: false; error: string } {
  return { success: false, error: err instanceof Error ? err.message : fallback };
}

/**
 * Writes the deal's invoiceId foreign key when an invoice is saved, since it
 * is the moment both records exist and are known to be the same billing.
 *
 * Only the link: whether the invoice is paid is read from the deal's payments
 * (see lib/payments.ts), so nothing here moves money or a payment status.
 */
async function linkInvoiceToCampaign(
  invoiceId: string,
  invoiceNo: string,
  options: { campaignId?: string; previousInvoiceNo?: string } = {}
): Promise<void> {
  const { campaignId, previousInvoiceNo } = options;
  const campaigns = await campaignRepository.getAll();
  // A renewal's invoice bills a licence extension, not the deal, and is
  // already linked from the renewal that raised it.
  if (invoiceOwner(invoiceId, campaigns)?.renewalId) return;
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
  // one does. The deal's reference follows the invoice's number on a new link,
  // and on a renumber when it named the old number, so the campaigns table
  // never shows a stale one. A deal quoting some other number keeps it: that
  // is a link the creator has not confirmed (see the edit sheet's invoice
  // picker), and rewriting its reference would make the wrong deal look right.
  const newLink = campaign.invoiceId !== invoiceId;
  const refFollows =
    newLink || Boolean(findInvoiceByCampaignRef(campaign.invoiceRef, [{ invoiceNo: previousInvoiceNo ?? invoiceNo }]));
  await campaignRepository.linkInvoice(
    campaign.id,
    invoiceId,
    refFollows ? buildInvoiceNumber(invoiceNo) : undefined
  );
}

export async function saveInvoiceDefaults(data: InvoiceData): Promise<ActionResult> {
  const denied = await requireSession();
  if (denied) return denied;

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
  const denied = await requireSession();
  if (denied) return denied;

  try {
    const record = await addInvoice(input);
    try {
      await linkInvoiceToCampaign(record.id, record.invoiceNo, { campaignId });
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
  const denied = await requireSession();
  if (denied) return denied;

  try {
    const change = await updateInvoiceRecord(input);
    // Outside the write above: the invoice edit stands even if the link
    // couldn't be written.
    try {
      await linkInvoiceToCampaign(input.id, input.invoiceNo, { previousInvoiceNo: change?.before.invoiceNo });
    } catch {
      // Reported through the pages below rather than failing a saved invoice.
    }
    revalidateStores("invoices", "campaigns");
    if (change) {
      // Collecting on a standalone invoice is the event worth finding later,
      // so it is logged as its own action rather than as another edit: but
      // only on the crossing into paid, or re-saving a paid invoice would log
      // it again. A linked invoice is never set paid here (see updateInvoice
      // in the writer); its deal's payments say so.
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
  const denied = await requireSession();
  if (denied) return denied;

  let trashId: string | null = null;
  let removed: InvoiceRecord | null = null;
  try {
    const [records, campaigns] = await Promise.all([readInvoiceRecords(), campaignRepository.getAll()]);
    const record = records.find((entry) => entry.id === id);
    if (!record) return { success: true };
    const campaignLinks = campaigns.flatMap((campaign) => {
      const linkedRenewals = campaign.usage.renewals
        .filter((renewal) => renewal.invoiceId === id)
        .map((renewal) => ({ renewalId: renewal.id, invoiceId: renewal.invoiceId }));
      if (campaign.invoiceId !== id && linkedRenewals.length === 0) return [];
      return [{
        campaignId: campaign.id,
        invoiceLink: campaign.invoiceId === id
          ? { invoiceId: campaign.invoiceId, invoiceRef: campaign.invoiceRef }
          : null,
        renewalLinks: linkedRenewals,
      }];
    });
    trashId = await addTrashEntry(
      { type: "invoice", record, campaignLinks },
      buildInvoiceNumber(record.invoiceNo)
    );
    removed = await deleteInvoice(id);
    if (!removed) {
      await removeTrashEntry(trashId);
      return { success: true };
    }
    // A deal pointing at an invoice that no longer exists would resolve to
    // nothing on every read; clearing the key returns it to its typed
    // reference, which is where it was before the invoice was raised.
    if (removed) {
      const removedInvoice = removed;
      const campaigns = await campaignRepository.getAll();
      const linked = campaigns.find((campaign) => campaign.invoiceId === removedInvoice.id);
      if (linked) await campaignRepository.linkInvoice(linked.id, "");
      // A renewal left pointing at it would hide its "Raise invoice" action for
      // good, since that only shows on a renewal with no invoice.
      for (const campaign of campaigns) {
        for (const renewal of campaign.usage.renewals) {
          if (renewal.invoiceId === removedInvoice.id) {
            await campaignRepository.linkRenewalInvoice(campaign.id, renewal.id, "");
          }
        }
      }
    }
    await activateTrashEntry(trashId);
    revalidateStores("invoices", "campaigns");
    if (removed) {
      await recordActivity({
        action: "invoice.deleted",
        entity: { type: "invoice", id: removed.id, label: buildInvoiceNumber(removed.invoiceNo) },
        detail: removed.client.name || undefined,
        amount: computeSubtotal(removed.items),
      });
    }
    return { success: true, trashId };
  } catch (err) {
    if (trashId) {
      if (removed) await activateTrashEntry(trashId);
      else await removeTrashEntry(trashId);
    }
    return toActionError(err, "Couldn't remove the invoice");
  }
}
