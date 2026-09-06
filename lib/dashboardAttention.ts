import type { BrandCampaignRecord } from "@/repositories/brandCampaigns";
import type { Invoice } from "@/repositories/invoices";
import { isInvoiceOverdue } from "@/lib/invoice";
import { normalizeBrandName } from "@/lib/brandCampaignStats";

// Client-safe pass over BrandCampaignRecord[]/Invoice[] that surfaces deals
// with an open loop the creator still has to close: the operational
// counterpart to selectDuePayments (money that's owed on a schedule). Kept
// out of the "server-only" repository so the dashboard card can import the
// type freely.

export type AttentionKind = "uninvoiced" | "untracked-payment" | "overdue-invoice";

export interface AttentionItem {
  kind: AttentionKind;
  campaignId: string; // for "overdue-invoice", this is the Invoice id instead, never collides with a real campaign id, and it's all NeedsAttentionCard needs to link to it
  brand: string;
  campaign: string;
  amount: number; // the deal's Total, for ranking + display
  label: string; // what's unresolved, in a few words
}

function normalized(value: string): string {
  return value.trim().toLowerCase();
}

function isDelivered(record: BrandCampaignRecord): boolean {
  return normalized(record.status) === "completed" || record.uploadDate.trim() !== "";
}

// Whether an invoice exists for this deal: either the campaign record's
// "Invoice ID" field points at one (it's auto-filled for paid deals added
// through the app), or a saved invoice in the invoices store names the same
// brand + campaign. The second check is what makes the "Delivered, no invoice
// raised" item clear itself once the creator saves an invoice from the link,
// since that save never writes back to the campaign record's field. Void
// invoices don't count: a voided invoice means the deal is still uninvoiced.
function isInvoiced(record: BrandCampaignRecord, invoices: Invoice[]): boolean {
  const recordInvoiceId = record.invoiceId.trim();
  if (recordInvoiceId !== "" && recordInvoiceId !== "-") {
    return true;
  }

  const brandKey = normalizeBrandName(record.brand);
  const campaignKey = normalized(record.campaign);
  if (brandKey === "" || campaignKey === "") return false;

  return invoices.some(
    (invoice) =>
      invoice.status !== "void" &&
      normalizeBrandName(invoice.client.name) === brandKey &&
      normalized(invoice.campaignName) === campaignKey
  );
}

export function selectAttentionItems(
  records: BrandCampaignRecord[],
  invoices: Invoice[] = [],
  now: Date = new Date()
): AttentionItem[] {
  const items: AttentionItem[] = [];

  for (const record of records) {
    if (normalized(record.status) === "cancelled") continue;
    // Barter-only deals aren't invoiced or chased for cash here.
    if (record.amount <= 0) continue;

    if (isDelivered(record) && !isInvoiced(record, invoices)) {
      items.push({
        kind: "uninvoiced",
        campaignId: record.campaignId,
        brand: record.brand,
        campaign: record.campaign,
        amount: record.total,
        label: "Delivered, no invoice raised",
      });
      continue;
    }

    // Completed work where the Payment column was never set either way and
    // there's no due date scheduling it: it would otherwise fall through
    // every reminder.
    if (
      normalized(record.status) === "completed" &&
      record.paymentStatus === "unknown" &&
      record.paymentDue === ""
    ) {
      items.push({
        kind: "untracked-payment",
        campaignId: record.campaignId,
        brand: record.brand,
        campaign: record.campaign,
        amount: record.total,
        label: "Completed, payment not tracked",
      });
    }
  }

  // Already-raised invoices past their due date: the sharpest follow-up
  // item there is, and previously only visible as a count badge on the
  // /invoices nav card.
  for (const invoice of invoices) {
    if (invoice.balanceDue <= 0) continue;
    if (!isInvoiceOverdue(invoice, now)) continue;
    items.push({
      kind: "overdue-invoice",
      campaignId: invoice.id,
      brand: invoice.client.name,
      campaign: invoice.campaignName,
      amount: invoice.balanceDue,
      label: "Invoice overdue",
    });
  }

  return items.sort((a, b) => b.amount - a.amount);
}
