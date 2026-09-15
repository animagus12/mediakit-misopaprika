import type { BrandCampaignRecord } from "@/repositories/brandCampaigns";
import type { Invoice } from "@/repositories/invoices";
import { isInvoiceOverdue } from "@/lib/invoice";
import { isCampaignCalledOff } from "@/lib/campaigns";

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

function isDelivered(record: BrandCampaignRecord): boolean {
  return record.status === "Posted" || record.uploadDate.trim() !== "";
}

// Whether this deal has an invoice: one is linked to it, and isn't void (a
// voided invoice leaves the deal uninvoiced). The same answer the campaigns
// table gives, which shows an invoice number only for a linked one.
//
// Linked only. Matching a saved invoice by brand and campaign name, or trusting
// a typed reference, cleared the warning for deals whose invoice billed
// someone else or never existed, while the table showed no invoice at all. An
// invoice raised by hand is linked from the campaign's edit sheet, which is
// what the "Create invoice" link here leads to.
function isInvoiced(record: BrandCampaignRecord, invoices: Invoice[]): boolean {
  if (!record.invoiceId) return false;
  const invoice = invoices.find((entry) => entry.id === record.invoiceId);
  // An invoice list that couldn't be read is not evidence the link is broken.
  return invoice ? invoice.status !== "void" : invoices.length === 0;
}

export function selectAttentionItems(
  records: BrandCampaignRecord[],
  invoices: Invoice[] = [],
  now: Date = new Date()
): AttentionItem[] {
  const items: AttentionItem[] = [];

  for (const record of records) {
    if (isCampaignCalledOff(record.status)) continue;
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

    // Posted work where the Payment column was never set either way and
    // there's no due date scheduling it: it would otherwise fall through
    // every reminder.
    if (
      record.status === "Posted" &&
      record.paymentStatus === "unknown" &&
      record.paymentDue === ""
    ) {
      items.push({
        kind: "untracked-payment",
        campaignId: record.campaignId,
        brand: record.brand,
        campaign: record.campaign,
        amount: record.total,
        label: "Posted, payment not tracked",
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
