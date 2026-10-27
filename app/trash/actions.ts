"use server";

import { revalidatePath } from "next/cache";
import { isPaymentTargetLive } from "@/lib/payments";
import { revalidateStores } from "@/lib/revalidation";
import { restoreAffiliatePayout } from "@/repositories/affiliatePayouts.writer.server";
import { restoreBrand } from "@/repositories/brands.writer.server";
import { restoreBrandNotes } from "@/repositories/brandNotes.writer.server";
import {
  readCampaignLedger,
  restoreCampaign,
  restoreCampaignBrandLinks,
  restoreCampaignInvoiceLinks,
} from "@/repositories/campaigns.writer.server";
import { restoreCampaignContacts } from "@/repositories/campaignContacts.writer.server";
import { restoreContacts } from "@/repositories/contacts.writer.server";
import { restoreContentItem } from "@/repositories/contentPlan.writer.server";
import { restoreEditorTransaction } from "@/repositories/editorTransactions.writer.server";
import { restoreInvoice, restoreInvoicesForBrand } from "@/repositories/invoices.writer.server";
import { restoreLinksDeletion } from "@/repositories/links.writer.server";
import type { PaymentTarget } from "@/repositories/payments";
import { restorePayments } from "@/repositories/payments.writer.server";
import { clearTrash, getTrashEntry, removeTrashEntry } from "@/repositories/trash.writer.server";
import { requireSession } from "@/lib/session.server";

type TrashActionResult = { success: true } | { success: false; error: string };

// A payment comes back only onto a deal, renewal or invoice that is live: one
// restored onto nothing would count as income against a target no page shows.
// A target sitting in Trash is not live, so it is restored first.
async function paymentTargetProblem(target: PaymentTarget): Promise<string | null> {
  const { campaigns, invoices } = await readCampaignLedger();
  if (isPaymentTargetLive(target, campaigns, invoices)) return null;
  if (target.kind === "invoice") return "Restore the invoice first";
  if (target.kind === "renewal" && campaigns.some((campaign) => campaign.id === target.campaignId)) {
    return "The renewal this payment was for no longer exists";
  }
  return "Restore the deal first";
}

export async function restoreTrashItem(id: string): Promise<TrashActionResult> {
  const denied = await requireSession();
  if (denied) return denied;

  try {
    const entry = await getTrashEntry(id);
    if (!entry) return { success: false, error: "That Trash item no longer exists" };
    if (entry.status !== "ready") {
      return { success: false, error: "This item is still being moved to Trash" };
    }

    switch (entry.payload.type) {
      case "brand":
        await restoreBrand(entry.payload.record);
        await restoreContacts(entry.payload.contacts);
        await restoreBrandNotes(entry.payload.notes);
        await restoreCampaignContacts(entry.payload.campaignContacts);
        await restoreCampaignBrandLinks(entry.payload.record.id, entry.payload.campaignIds);
        await restoreInvoicesForBrand(entry.payload.invoiceIds, entry.payload.record.id);
        revalidateStores("brands", "contacts", "brandNotes", "campaignContacts", "campaigns", "invoices");
        break;
      case "contact":
        await restoreContacts([entry.payload.record]);
        revalidateStores("contacts", "brands");
        break;
      case "brandNote":
        await restoreBrandNotes([entry.payload.record]);
        revalidateStores("brandNotes");
        break;
      case "affiliatePayout":
        await restoreAffiliatePayout(entry.payload.record);
        revalidateStores("affiliatePayouts", "affiliatePartners");
        break;
      case "invoice":
        await restoreInvoice(entry.payload.record);
        await restoreCampaignInvoiceLinks(entry.payload.campaignLinks, entry.payload.record.id);
        await restorePayments(entry.payload.payments ?? []);
        revalidateStores("invoices", "campaigns", "payments");
        break;
      case "campaign":
        await restoreCampaign(entry.payload.record);
        await restoreCampaignContacts(entry.payload.contacts);
        await restorePayments(entry.payload.payments ?? []);
        revalidateStores("campaigns", "campaignContacts", "payments");
        break;
      case "payment": {
        const problem = await paymentTargetProblem(entry.payload.record.target);
        if (problem) return { success: false, error: problem };
        await restorePayments([entry.payload.record]);
        revalidateStores("payments");
        break;
      }
      case "editorTransaction":
        await restoreEditorTransaction(entry.payload.record);
        revalidateStores("editorTransactions");
        break;
      case "contentItem":
        await restoreContentItem(entry.payload.record);
        revalidateStores("contentPlan");
        break;
      case "linksSection":
      case "linksItem":
      case "linksSocial":
        for (const target of entry.payload.targets) {
          await restoreLinksDeletion(entry.payload, target);
        }
        revalidatePath("/links-editor");
        revalidatePath("/links");
        revalidatePath("/");
        break;
    }

    await removeTrashEntry(id);
    revalidatePath("/trash");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Couldn't restore this item",
    };
  }
}

export async function deleteTrashItem(id: string): Promise<TrashActionResult> {
  const denied = await requireSession();
  if (denied) return denied;

  try {
    const entry = await getTrashEntry(id);
    if (!entry) return { success: false, error: "That Trash item no longer exists" };
    await removeTrashEntry(id);
    revalidatePath("/trash");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Couldn't permanently delete this item",
    };
  }
}

export async function emptyTrash(): Promise<TrashActionResult> {
  const denied = await requireSession();
  if (denied) return denied;

  try {
    await clearTrash();
    revalidatePath("/trash");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Couldn't empty Trash",
    };
  }
}
