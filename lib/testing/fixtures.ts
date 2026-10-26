// Typed builders for the money tests. Each one starts from a small, valid
// record and takes only the fields a test cares about, so a test reads as the
// rule it pins rather than as a wall of setup.
//
// Records go through the real to*() mappers where one exists (toCampaign,
// toInvoice, toEditorTransaction), so derived fields such as Campaign.total
// and Invoice.balanceDue are computed exactly as the app computes them and
// never hand-written into a fixture where they could disagree.
//
// Test-only: nothing in the app imports this, and it must never import Redis
// or a *.writer.server module.
import type { DuePayment } from "@/lib/brandCampaignStats";
import type { InvoiceEditorJobOption } from "@/lib/invoice";
import type { BrandCampaignRecord } from "@/repositories/brandCampaigns";
import {
  emptyUsage,
  toCampaign,
  type Campaign,
  type CampaignRecord,
  type StoredUsage,
  type UsageRenewalRecord,
} from "@/repositories/campaigns";
import type { EarningsPayout, MonthlyEarnings } from "@/repositories/earnings";
import {
  toEditorTransaction,
  type EditorTransaction,
  type EditorTransactionRecord,
} from "@/repositories/editorTransactions";
import { toInvoice, type Invoice, type InvoiceRecord } from "@/repositories/invoices";

export function makeCampaign(overrides: Partial<CampaignRecord> = {}): Campaign {
  return toCampaign({
    id: "MSP-MC0001",
    date: "01/05/2026",
    uploadDate: "",
    brand: "Acme",
    brandId: null,
    campaign: "Launch",
    type: "Paid",
    reels: 1,
    story: 0,
    status: "Posted",
    amount: 10000,
    barterValue: 0,
    paymentStatus: "received",
    paymentDue: "",
    paidDate: "",
    paymentMethod: "",
    invoiceRef: "",
    invoiceId: null,
    ...overrides,
  });
}

export function makeRenewal(overrides: Partial<UsageRenewalRecord> = {}): UsageRenewalRecord {
  return {
    id: "R0001",
    startDate: "01/06/2026",
    days: 30,
    amount: 3000,
    paymentStatus: "received",
    paymentDue: "",
    paidDate: "",
    paymentMethod: "",
    invoiceId: "",
    recordedAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

/** A stored licence carrying the given renewals and otherwise empty. */
export function makeUsage(overrides: Partial<StoredUsage> = {}): StoredUsage {
  return { ...emptyUsage(), ...overrides };
}

export function makePayout(overrides: Partial<EarningsPayout> = {}): EarningsPayout {
  return {
    partner: "Shop",
    commissionAmount: 1000,
    paidDate: "",
    periodEnd: "31/05/2026",
    paymentStatus: "received",
    ...overrides,
  };
}

export function makeMonthlyEarnings(
  month: string,
  overrides: Partial<Omit<MonthlyEarnings, "month">> = {}
): MonthlyEarnings {
  return {
    month,
    total: 0,
    paid: 0,
    barter: 0,
    commission: 0,
    pending: 0,
    deals: [],
    ...overrides,
  };
}

export function makeInvoice(overrides: Partial<InvoiceRecord> = {}): Invoice {
  return toInvoice({
    id: "inv-1",
    status: "sent",
    invoiceNo: "0001",
    brandId: null,
    editorTransactionId: null,
    campaignName: "Launch",
    issueDate: "2026-05-01",
    dueDate: "2026-05-15",
    client: { name: "Acme", contactName: "", email: "" },
    items: [{ desc: "Reel", sub: "", qty: 1, price: 10000 }],
    advance: 0,
    barter: { enabled: false, value: 0, status: "" },
    payment: {
      payeeName: "",
      payeeEmail: "",
      mode: "upi",
      upi: "",
      bank: { accountName: "", accountNumber: "", ifsc: "", bankName: "" },
      footerNote: "",
      closingLine: "",
      qrImage: null,
      stampImage: null,
    },
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
    ...overrides,
  });
}

export function makeEditorTransaction(
  overrides: Partial<EditorTransactionRecord> = {}
): EditorTransaction {
  return toEditorTransaction({
    id: "ET0001",
    video: "Launch reel",
    videoDate: "01/05/2026",
    deliveryDate: "",
    amount: 400,
    editor: "Editor",
    status: "Paid",
    ...overrides,
  });
}

export function makeEditorJob(overrides: Partial<InvoiceEditorJobOption> = {}): InvoiceEditorJobOption {
  return {
    id: "ET0001",
    video: "Launch reel",
    editor: "Editor",
    amount: 400,
    status: "Paid",
    ...overrides,
  };
}

export function makeBrandCampaignRecord(
  overrides: Partial<BrandCampaignRecord> = {}
): BrandCampaignRecord {
  const amount = overrides.amount ?? 10000;
  const barterValue = overrides.barterValue ?? 0;
  return {
    campaignId: "MSP-MC0001",
    brand: "Acme",
    brandId: null,
    campaign: "Launch",
    deliverables: "1 Organic Reel",
    date: "01/05/2026",
    uploadDate: "",
    status: "Posted",
    amount,
    barterValue,
    total: amount + barterValue,
    invoiceRef: "",
    invoiceId: null,
    paymentStatus: "pending",
    paymentDue: "",
    paidDate: "",
    paymentMethod: "",
    usage: emptyUsage(),
    ...overrides,
  };
}

export function makeDuePayment(
  overrides: Partial<Omit<DuePayment, "record">> & { record?: Partial<BrandCampaignRecord> } = {}
): DuePayment {
  const { record, ...rest } = overrides;
  const daysUntilDue = rest.daysUntilDue ?? 5;
  return {
    record: makeBrandCampaignRecord(record),
    dueDate: "15/05/2026",
    daysUntilDue,
    overdue: daysUntilDue < 0,
    label: "",
    ...rest,
  };
}
