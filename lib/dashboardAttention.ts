import type { BrandCampaignRecord } from "@/repositories/brandCampaigns";

// Client-safe pass over BrandCampaignRecord[] that surfaces deals with an
// open loop the creator still has to close — the operational counterpart to
// selectDuePayments (money that's owed on a schedule). Kept out of the
// "server-only" repository so the dashboard card can import the type freely.

export type AttentionKind = "uninvoiced" | "untracked-payment";

export interface AttentionItem {
  kind: AttentionKind;
  campaignId: string;
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

// A paid deal gets an Invoice ID auto-assigned when it's added through the
// app; "" or "-" means nothing was ever raised for it.
function hasInvoice(record: BrandCampaignRecord): boolean {
  const id = record.invoiceId.trim();
  return id !== "" && id !== "-";
}

export function selectAttentionItems(records: BrandCampaignRecord[]): AttentionItem[] {
  const items: AttentionItem[] = [];

  for (const record of records) {
    if (normalized(record.status) === "cancelled") continue;
    // Barter-only deals aren't invoiced or chased for cash here.
    if (record.amount <= 0) continue;

    if (isDelivered(record) && !hasInvoice(record)) {
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
    // there's no due date scheduling it — it would otherwise fall through
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

  return items.sort((a, b) => b.amount - a.amount);
}
