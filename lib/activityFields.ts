import { formatMoney } from "@/lib/invoice";
import { countOf, type DiffField } from "@/lib/activityDiff";
import type { Agency } from "@/repositories/agencies";
import type { Brand } from "@/repositories/brands";
import type { CampaignRecord } from "@/repositories/campaigns";
import type { Contact } from "@/repositories/contacts";
import type { Editor } from "@/repositories/editors";
import type { EditorTransactionRecord } from "@/repositories/editorTransactions";
import type { InvoiceRecord } from "@/repositories/invoices";

// Which fields an update event reports on, per record type. Gathered here
// rather than next to each action so that "what does the log actually watch"
// is one file rather than seven, and so adding a tracked field is a one-line
// change in a list instead of a change to an action.
//
// Labels are lowercase: they land mid-sentence ("status Lead to Active").
// Order matters, since only the first few changes are shown and the rest
// collapse into a count: the most consequential fields come first.
//
// createdAt/updatedAt are deliberately absent everywhere. They change on
// every write by definition, so reporting them would mean every update event
// reads "updated at ... to ...".

function money(value: unknown): string {
  return typeof value === "number" ? formatMoney(value) : "";
}

export const brandFields: readonly DiffField<Brand>[] = [
  { label: "status", value: (brand) => brand.status },
  { label: "name", value: (brand) => brand.name },
  { label: "website", value: (brand) => brand.website },
  { label: "instagram", value: (brand) => brand.instagram },
  // Ids and blob URLs say nothing to a reader, so only the fact is recorded.
  { label: "agency", value: (brand) => brand.agencyId, redact: true },
  { label: "primary contact", value: (brand) => brand.primaryContactId, redact: true },
  { label: "logo", value: (brand) => brand.logoUrl, redact: true },
];

export const contactFields: readonly DiffField<Contact>[] = [
  { label: "name", value: (contact) => contact.name },
  { label: "phone", value: (contact) => contact.phone },
  { label: "brand", value: (contact) => contact.brandId, redact: true },
  { label: "agency", value: (contact) => contact.agencyId, redact: true },
];

export const agencyFields: readonly DiffField<Agency>[] = [
  { label: "name", value: (agency) => agency.name },
];

export const campaignFields: readonly DiffField<CampaignRecord>[] = [
  { label: "status", value: (campaign) => campaign.status },
  { label: "payment", value: (campaign) => campaign.paymentStatus },
  { label: "amount", value: (campaign) => campaign.amount, format: money },
  { label: "barter value", value: (campaign) => campaign.barterValue, format: money },
  { label: "name", value: (campaign) => campaign.campaign },
  { label: "brand", value: (campaign) => campaign.brand },
  { label: "type", value: (campaign) => campaign.type },
  { label: "payment due", value: (campaign) => campaign.paymentDue },
  { label: "upload date", value: (campaign) => campaign.uploadDate },
  { label: "deal date", value: (campaign) => campaign.date },
  { label: "invoice", value: (campaign) => campaign.invoiceId },
  { label: "deliverables", value: (campaign) => `${campaign.reels} ${campaign.story}`.trim() },
  { label: "payment method", value: (campaign) => campaign.paymentMethod },
  // Free text, and long: the fact it moved is the useful part.
  { label: "notes", value: (campaign) => campaign.notes, redact: true },
];

export const invoiceFields: readonly DiffField<InvoiceRecord>[] = [
  { label: "status", value: (invoice) => invoice.status },
  { label: "client", value: (invoice) => invoice.client.name },
  { label: "campaign", value: (invoice) => invoice.campaignName },
  { label: "line items", value: (invoice) => invoice.items, format: countOf },
  { label: "advance", value: (invoice) => invoice.advance, format: money },
  { label: "number", value: (invoice) => invoice.invoiceNo },
  { label: "due date", value: (invoice) => invoice.dueDate },
  { label: "issue date", value: (invoice) => invoice.issueDate },
  { label: "barter value", value: (invoice) => invoice.barter.value, format: money },
  // Redacted, and not for brevity: this block carries the payee's bank
  // account number and IFSC, and the log outlives the invoice it describes.
  { label: "payment details", value: (invoice) => invoice.payment, redact: true },
];

export const editorFields: readonly DiffField<Editor>[] = [
  { label: "name", value: (editor) => editor.name },
  { label: "phone", value: (editor) => editor.phone },
  { label: "email", value: (editor) => editor.email },
  // A UPI id is a payment handle; recorded as changed, never quoted.
  { label: "UPI", value: (editor) => editor.upi, redact: true },
  { label: "QR", value: (editor) => editor.qrImage, redact: true },
];

export const editorTransactionFields: readonly DiffField<EditorTransactionRecord>[] = [
  { label: "status", value: (record) => record.status },
  { label: "amount", value: (record) => record.amount, format: money },
  { label: "editor", value: (record) => record.editor },
  { label: "video", value: (record) => record.video },
  { label: "delivery date", value: (record) => record.deliveryDate },
  { label: "video date", value: (record) => record.videoDate },
];
