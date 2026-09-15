import { toIsoDate } from "@/lib/campaigns";
import { formatInvoiceDate, isInvoiceNoTaken, reservedInvoiceNumbers } from "@/lib/invoice";
import { deliverableCount } from "@/lib/rateCard";
import { addDaysISO, nextInvoiceNo, paymentSnapshot, termLine } from "@/lib/usageInvoice";
import type { InvoiceLineItemInput, InvoiceData } from "@/repositories/invoice";
import type { NewInvoice } from "@/repositories/invoices";
import type { Campaign } from "@/repositories/campaigns";

// Turns a deal into the invoice that bills for it, as a draft for the editor.
//
// Everything an invoice asks for is already on the deal: who the brand is,
// what was delivered, what it was agreed at, how much of that was for ad
// usage, when it is due, and whether it has been paid. Retyping it into the
// editor was transcription, and transcription is where a figure goes wrong.
//
// Unlike buildRenewalInvoice, this is never saved on its own. It seeds the
// editor, and the creator saves it from there, because a deal's invoice is the
// one document a brand's accounts team actually reads and it deserves a look
// before it exists.

export interface CampaignInvoiceInput {
  campaign: Campaign;
  /** The payee/bank/branding block and billing terms, as the editor seeds them. */
  defaults: InvoiceData;
  /** Every saved invoice, so the number picked cannot collide with one. */
  existing: { invoiceNo: string }[];
  /** Every deal, so a fallback number is not one another deal already quotes. */
  campaigns: { invoiceRef: string; invoiceId: string | null }[];
  /** The brand's primary contact, or "" when it has none on file. */
  contactName: string;
  today: string; // yyyy-mm-dd
}

// The auto-assigned reference is "MSP-INV-0012"; the invoice stores "0012".
const INVOICE_REF = /^MSP-INV-(\d+)$/i;

/**
 * The number the deal already quotes, when it can be used as is.
 *
 * A paid deal is given an invoice reference the moment it is added, and the
 * brand may already have been told it. Raising the invoice under that same
 * number keeps the two records agreeing without anyone reconciling them. It
 * falls back to the next free number when the deal quotes none, quotes
 * something else, or quotes one another invoice already took (a record from
 * before deal references and invoice numbers were one sequence). The fallback
 * skips every number another deal quotes too, or saving it would match that
 * deal's reference rather than this one.
 */
function invoiceNoFor(input: CampaignInvoiceInput): string {
  const match = input.campaign.invoiceRef.trim().match(INVOICE_REF);
  if (match && !isInvoiceNoTaken(match[1], input.existing.map((invoice) => invoice.invoiceNo))) {
    return match[1];
  }
  return nextInvoiceNo(
    reservedInvoiceNumbers(input.existing, input.campaigns),
    input.defaults.invoiceNumberSeed
  );
}

/** "1 Reel + 1 Story", leaving out a deliverable the deal did not include. */
function deliverablesLine(campaign: Campaign): string {
  return [campaign.reels, campaign.story]
    .filter((value) => deliverableCount(value) > 0)
    .join(" + ");
}

/** How long the licence runs, as the invoice states it: "25 days from 10.08.2026". */
function usageLine(campaign: Campaign): string {
  const from = toIsoDate(campaign.uploadDate);
  if (campaign.usage.indefinite) {
    return from ? `Indefinite, from ${formatInvoiceDate(from)}` : "Indefinite";
  }
  return campaign.usage.days > 0 ? termLine(campaign.usage.days, from) : "";
}

/**
 * The deal's cash, split into what the post cost and what the ad rights cost.
 *
 * Two lines when the deal charged a usage fee, since that is exactly the
 * split the rate card sells ("Reel + Story + Ad Usage") and the brand should
 * see what the licence is costing them. The fee is charged on top of the
 * amount (see CampaignUsage.fee), so the two lines sum to the deal's cash.
 */
function lineItems(campaign: Campaign): InvoiceLineItemInput[] {
  const deliverables = deliverablesLine(campaign);
  const fee = campaign.usage.fee;
  const items: InvoiceLineItemInput[] = [
    {
      desc: deliverables ? `Instagram ${deliverables}` : campaign.campaign.trim() || "Content collaboration",
      sub: deliverables && campaign.campaign.trim() ? campaign.campaign.trim() : "",
      qty: 1,
      price: campaign.amount,
    },
  ];
  if (fee > 0) {
    items.push({
      desc: "Ad usage rights",
      sub: usageLine(campaign),
      qty: 1,
      price: fee,
    });
  }
  return items;
}

/**
 * The invoice for one deal, with every field the editor would have asked for
 * already answered.
 *
 * Its campaign name is the deal's own, unchanged, so the invoice reads as the
 * deal it bills. Whether the deal counts as invoiced comes from the link that
 * saving it writes, not from the name.
 *
 * Marked paid when the deal's money is already in, and a draft otherwise: the
 * app cannot know an invoice was sent, and a "sent" invoice nobody sent would
 * have the dashboard chasing it.
 */
export function buildCampaignInvoice(input: CampaignInvoiceInput): NewInvoice {
  const { campaign, defaults } = input;
  const cashReceived = campaign.cash > 0 && campaign.paymentStatus === "received";

  return {
    status: cashReceived ? "paid" : "draft",
    invoiceNo: invoiceNoFor(input),
    brandId: campaign.brandId,
    editorTransactionId: campaign.editorTransactionId,
    campaignName: campaign.campaign.trim(),
    issueDate: input.today,
    // The date the payment was agreed for wins; the defaults' terms fill in
    // only when the deal was recorded without one.
    dueDate: toIsoDate(campaign.paymentDue) || addDaysISO(input.today, defaults.dueInDays),
    client: {
      name: campaign.brand.trim(),
      contactName: input.contactName.trim(),
      // Contacts carry no email and the defaults' billed-to block is a
      // placeholder: left blank rather than inventing an address.
      email: "",
    },
    items: lineItems(campaign),
    advance: 0,
    barter: {
      enabled: campaign.barterValue > 0,
      value: campaign.barterValue,
      status: campaign.paymentStatus === "received" ? "Received" : "Pending",
    },
    payment: paymentSnapshot(defaults),
  };
}
