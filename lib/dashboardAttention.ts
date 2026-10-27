import type { BrandCampaignRecord } from "@/repositories/brandCampaigns";
import type { Invoice } from "@/repositories/invoices";
import type { PaymentRecord } from "@/repositories/payments";
import { buildInvoiceNumber, isInvoiceOverdue } from "@/lib/invoice";
import { campaignLabel, isCampaignCalledOff, toIsoDate, toSheetDate } from "@/lib/campaigns";
import { todayKey } from "@/lib/day";

// Client-safe pass over BrandCampaignRecord[]/Invoice[] that surfaces deals
// with an open loop the creator still has to close: the operational
// counterpart to selectDuePayments (money that's owed on a schedule). Kept
// out of the "server-only" repository so the dashboard card can import the
// type freely.

export type AttentionKind =
  | "uninvoiced"
  | "untracked-payment"
  | "overdue-invoice"
  | "overpaid"
  | "orphan-payment";

export interface AttentionItem {
  kind: AttentionKind;
  campaignId: string; // for "overdue-invoice", this is the Invoice id instead, never collides with a real campaign id, and it's all NeedsAttentionCard needs to link to it
  brand: string;
  campaign: string;
  amount: number; // the deal's Total, for ranking + display
  label: string; // what's unresolved, in a few words
  /** Where the fix is, for the kinds whose link isn't derived from the kind alone. */
  href?: string;
}

/** Where a deal is opened by name: the campaigns table, searched for it. */
function dealHref(record: Pick<BrandCampaignRecord, "campaign" | "brand">): string {
  return `/campaigns?q=${encodeURIComponent(campaignLabel(record.campaign, record.brand))}`;
}

// Money recorded beyond what a deal, renewal or invoice is worth. The
// recording form refuses it, so it only appears when the amount owed was
// lowered afterwards: either the amount or a payment is now wrong.
function overpaidItems(records: BrandCampaignRecord[], invoices: Invoice[]): AttentionItem[] {
  const items: AttentionItem[] = [];
  const label = "Received more than it's worth";
  for (const record of records) {
    if (record.settlement && record.settlement.overpaid > 0) {
      items.push({
        kind: "overpaid",
        campaignId: record.campaignId,
        brand: record.brand,
        campaign: record.campaign,
        amount: record.settlement.overpaid,
        label,
        href: dealHref(record),
      });
    }
    for (const renewal of record.usage.renewals) {
      if (renewal.settlement.overpaid <= 0) continue;
      items.push({
        kind: "overpaid",
        campaignId: `${record.campaignId}:${renewal.id}`,
        brand: record.brand,
        campaign: `${campaignLabel(record.campaign, record.brand)} · usage renewal`,
        amount: renewal.settlement.overpaid,
        label,
        href: dealHref(record),
      });
    }
  }
  for (const invoice of invoices) {
    if (invoice.owner || invoice.settlement.overpaid <= 0) continue;
    items.push({
      kind: "overpaid",
      campaignId: invoice.id,
      brand: invoice.client.name,
      campaign: `Invoice ${buildInvoiceNumber(invoice.invoiceNo)}`,
      amount: invoice.settlement.overpaid,
      label,
      href: `/invoices/${invoice.id}`,
    });
  }
  return items;
}

// Whether the creator's side of the deal is actually done.
//
// The upload date doubles as the *planned* post date: the content calendar
// writes it when a deal is dragged onto a day, and selectUnscheduledPosts
// treats a blank one as "still needs a date". So a date alone says only that
// the post is on the schedule, and treating any date as proof of delivery put
// work that hasn't been filmed yet under "Delivered, no invoice raised".
//
// A date that has come round still counts, because a post that went up is
// regularly logged by its date before anyone remembers to move the status.
function isDelivered(record: BrandCampaignRecord, today: string): boolean {
  if (record.status === "Posted") return true;
  const uploadKey = toIsoDate(record.uploadDate);
  return uploadKey !== "" && uploadKey <= today;
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

/**
 * `orphanPayments` are stored payments whose deal, renewal or invoice is gone
 * (see findOrphanPayments): money still on the books against nothing a page
 * shows, listed on the Payments page to delete.
 */
export function selectAttentionItems(
  records: BrandCampaignRecord[],
  invoices: Invoice[] = [],
  now: Date = new Date(),
  orphanPayments: PaymentRecord[] = []
): AttentionItem[] {
  const items: AttentionItem[] = overpaidItems(records, invoices);
  const today = todayKey(now);

  for (const payment of orphanPayments) {
    items.push({
      kind: "orphan-payment",
      campaignId: payment.id,
      brand: "Payment for a deleted record",
      campaign: payment.date ? `Received ${toSheetDate(payment.date)}` : "Date not recorded",
      amount: payment.gross,
      label: "Not linked to a deal",
      href: "/payments#unlinked",
    });
  }

  for (const record of records) {
    if (isCampaignCalledOff(record.status)) continue;
    // Barter-only deals aren't invoiced or chased for cash here.
    if (record.amount <= 0) continue;

    if (isDelivered(record, today) && !isInvoiced(record, invoices)) {
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

  // Money that doesn't add up comes first, however small: until it is fixed,
  // every figure built on it is wrong. The rest are follow-ups, biggest first.
  return items.sort((a, b) => Number(isBookError(b)) - Number(isBookError(a)) || b.amount - a.amount);
}

function isBookError(item: AttentionItem): boolean {
  return item.kind === "overpaid" || item.kind === "orphan-payment";
}
