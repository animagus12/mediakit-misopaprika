"use server";

import { revalidateStores } from "@/lib/revalidation";
import { saveInvoiceData } from "@/repositories/invoice.writer.server";
import {
  addInvoice,
  deleteInvoice,
  updateInvoice as updateInvoiceRecord,
} from "@/repositories/invoices.writer.server";
import { getCampaigns, setCampaignPaymentStatus } from "@/repositories/campaigns.writer.server";
import { buildInvoiceNumber } from "@/lib/invoice";
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
  const campaign = (await getCampaigns()).find((entry) => entry.invoiceId.trim().toUpperCase() === ref.toUpperCase());
  if (!campaign) return;

  const target = status === "paid" ? "received" : "pending";
  if (campaign.paymentStatus === target) return;
  // Only ever flips between the two states this action owns: a deal marked
  // "unknown" (e.g. a cancelled one) is left as it is.
  if (campaign.paymentStatus !== "received" && campaign.paymentStatus !== "pending") return;

  await setCampaignPaymentStatus(campaign.id, target);
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
    return { success: true, id: record.id };
  } catch (err) {
    return toActionError(err, "Couldn't save the invoice");
  }
}

export async function updateInvoice(input: InvoiceUpdate): Promise<ActionResult> {
  try {
    await updateInvoiceRecord(input);
    // Outside the write above for the same reason as the dashboard's mark
    // received: the invoice edit stands even if the deal couldn't follow.
    try {
      await syncLinkedCampaignPayment(input.invoiceNo, input.status);
    } catch {
      // Reported through the pages below rather than failing a saved invoice.
    }
    revalidateStores("invoices", "campaigns");
    return { success: true };
  } catch (err) {
    return toActionError(err, "Couldn't save the invoice");
  }
}

export async function removeInvoice(id: string): Promise<ActionResult> {
  try {
    await deleteInvoice(id);
    revalidateStores("invoices");
    return { success: true };
  } catch (err) {
    return toActionError(err, "Couldn't remove the invoice");
  }
}
