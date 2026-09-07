"use server";

import { revalidateStores } from "@/lib/revalidation";
import { saveInvoiceData } from "@/repositories/invoice.writer.server";
import {
  addInvoice,
  deleteInvoice,
  updateInvoice as updateInvoiceRecord,
} from "@/repositories/invoices.writer.server";
import { campaignRepository } from "@/repositories/campaignRepository";
import { buildInvoiceNumber, computeSubtotal } from "@/lib/invoice";
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
 * and moving it back off "paid" returns the deal to pending.
 *
 * Without this the two records drift in the opposite direction from the
 * dashboard bug: the invoice reads Paid while "Payments due" still lists the
 * deal and Earnings still counts it as outstanding, because every one of
 * those is computed from Campaign.paymentStatus alone (see selectDuePayments).
 *
 * A deal already in the target state is left alone, so this never overwrites a
 * "unknown" payment status that nobody asked it to touch.
 */
async function syncLinkedCampaignPayment(invoiceNo: string, status: InvoiceStatus): Promise<void> {
  if (status !== "paid" && status !== "sent") return;

  const ref = buildInvoiceNumber(invoiceNo);
  const campaigns = await campaignRepository.getAll();
  const campaign = campaigns.find((entry) => entry.invoiceId.trim().toUpperCase() === ref.toUpperCase());
  if (!campaign) return;

  const target = status === "paid" ? "received" : "pending";
  if (campaign.paymentStatus === target) return;
  // Only ever flips between the two states this action owns: a deal marked
  // "unknown" (e.g. a cancelled one) is left as it is.
  if (campaign.paymentStatus !== "received" && campaign.paymentStatus !== "pending") return;

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

export async function createInvoice(
  input: NewInvoice
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  try {
    const record = await addInvoice(input);
    // An invoice can be raised already marked paid against a deal that already
    // references its number, so creation syncs the same way an edit does.
    try {
      await syncLinkedCampaignPayment(record.invoiceNo, record.status);
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
      await syncLinkedCampaignPayment(input.invoiceNo, input.status);
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
    revalidateStores("invoices");
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
