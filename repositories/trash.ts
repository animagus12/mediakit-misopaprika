import type { AffiliatePayout } from "./affiliatePayouts";
import type { Brand } from "./brands";
import type { BrandNote } from "./brandNotes";
import type { CampaignContact } from "./campaignContacts";
import type { Contact } from "./contacts";
import type { CampaignRecord } from "./campaigns";
import type { ContentItemRecord } from "./contentPlan";
import type { EditorTransactionRecord } from "./editorTransactions";
import type { InvoiceRecord } from "./invoices";
import type { LinkItem, LinkSection, SocialHandle } from "./links";
import type { PaymentRecord } from "./payments";

export type LinkTrashTarget = "draft" | "published";

export type LinkTrashDeletion =
  | { type: "linksSection"; record: LinkSection; index: number; label: string }
  | {
      type: "linksItem";
      record: LinkItem;
      sectionId: string;
      index: number;
      label: string;
    }
  | { type: "linksSocial"; record: SocialHandle; index: number; label: string };

export type TrashPayload =
  | {
      type: "brand";
      record: Brand;
      contacts: Contact[];
      notes: BrandNote[];
      campaignContacts: CampaignContact[];
      campaignIds: string[];
      invoiceIds: string[];
    }
  | { type: "contact"; record: Contact }
  | { type: "brandNote"; record: BrandNote }
  | { type: "affiliatePayout"; record: AffiliatePayout }
  | {
      type: "invoice";
      record: InvoiceRecord;
      campaignLinks: {
        campaignId: string;
        invoiceLink: { invoiceId: string; invoiceRef: string } | null;
        renewalLinks: { renewalId: string; invoiceId: string }[];
      }[];
      /** The invoice's own payments, when it was standalone. Absent on older entries. */
      payments?: PaymentRecord[];
    }
  | {
      type: "campaign";
      record: CampaignRecord;
      contacts: CampaignContact[];
      /** Payments against the deal and its renewals. Absent on older entries. */
      payments?: PaymentRecord[];
    }
  | {
      type: "payment";
      record: PaymentRecord;
      /** What the payment was for, as it read when deleted: "Acme · Launch". */
      targetLabel: string;
    }
  | { type: "editorTransaction"; record: EditorTransactionRecord }
  | { type: "contentItem"; record: ContentItemRecord }
  | (LinkTrashDeletion & { targets: LinkTrashTarget[] });

export interface TrashEntry {
  id: string;
  label: string;
  deletedAt: string;
  status: "pending" | "ready";
  payload: TrashPayload;
}

export function trashTypeLabel(type: TrashPayload["type"]): string {
  switch (type) {
    case "brand":
      return "Brand";
    case "contact":
      return "Contact";
    case "brandNote":
      return "Brand note";
    case "affiliatePayout":
      return "Affiliate payout";
    case "invoice":
      return "Invoice";
    case "campaign":
      return "Campaign";
    case "payment":
      return "Payment";
    case "editorTransaction":
      return "Editor transaction";
    case "contentItem":
      return "Calendar item";
    case "linksSection":
      return "Link section";
    case "linksItem":
      return "Link";
    case "linksSocial":
      return "Social link";
  }
}
