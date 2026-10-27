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
import { invoiceDueDates, withInvoiceDueDate, type InvoiceEditorJobOption } from "@/lib/invoice";
import { attachSettlements } from "@/lib/payments";
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
import type { PaymentRecord } from "@/repositories/payments";

/** A stored payment: ₹10,000 on a deal, into Business funds, by UPI. */
export function makePaymentRecord(overrides: Partial<PaymentRecord> = {}): PaymentRecord {
  return {
    id: "5f0c6f1e-2b7a-4c1d-9a3e-000000000001",
    target: { kind: "deal", campaignId: "MSP-MC0001" },
    date: "2026-05-20",
    gross: 10000,
    tds: 0,
    bankFee: 0,
    receivedInto: "business",
    method: "UPI",
    reference: "",
    note: "",
    origin: "recorded",
    createdAt: "2026-05-20T10:00:00.000Z",
    updatedAt: "2026-05-20T10:00:00.000Z",
    ...overrides,
  };
}

/**
 * Deals as the repository reads them (readCampaignLedger): each record mapped,
 * its due dates taken from the invoices, and the ledger joined on.
 */
export function ledgerCampaigns(
  records: CampaignRecord[],
  invoices: InvoiceRecord[] = [],
  payments: PaymentRecord[] = []
): Campaign[] {
  const dueDates = invoiceDueDates(invoices);
  return attachSettlements(
    records.map((record) => withInvoiceDueDate(toCampaign(record), dueDates)),
    invoices,
    payments
  );
}

/** A deal as stored, before toCampaign derives anything from it. */
export function makeCampaignRecord(overrides: Partial<CampaignRecord> = {}): CampaignRecord {
  return {
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
  };
}

export function makeCampaign(overrides: Partial<CampaignRecord> = {}): Campaign {
  return toCampaign(makeCampaignRecord(overrides));
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
    tdsRate: null,
    tdsAmount: null,
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
    tds: 0,
    fees: 0,
    net: 0,
    barter: 0,
    commission: 0,
    pending: 0,
    deals: [],
    ...overrides,
  };
}

/** An invoice as stored, before toInvoice derives anything from it. */
export function makeInvoiceRecord(overrides: Partial<InvoiceRecord> = {}): InvoiceRecord {
  return {
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
  };
}

export function makeInvoice(overrides: Partial<InvoiceRecord> = {}): Invoice {
  return toInvoice(makeInvoiceRecord(overrides));
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

type BrandCampaignRecordOverrides = Partial<
  Omit<BrandCampaignRecord, "usage" | "settlement" | "barterState">
> & { usage?: StoredUsage };

/**
 * A brand CRM row, built through toCampaign from the deal it projects, so its
 * settlement and barter state are derived exactly as a read derives them.
 * `amount` is the row's cash (the deal's amount plus any usage fee).
 */
export function makeBrandCampaignRecord(overrides: BrandCampaignRecordOverrides = {}): BrandCampaignRecord {
  const amount = overrides.amount ?? 10000;
  const barterValue = overrides.barterValue ?? 0;
  const usage = overrides.usage ?? emptyUsage();
  const campaign = toCampaign(
    makeCampaignRecord({
      id: overrides.campaignId ?? "MSP-MC0001",
      type: barterValue > 0 ? (amount > 0 ? "Barter+Paid" : "Barter") : "Paid",
      status: overrides.status ?? "Posted",
      amount: amount - (usage.fee ?? 0),
      barterValue,
      paymentStatus: overrides.paymentStatus ?? "pending",
      paidDate: overrides.paidDate ?? "",
      paymentDue: overrides.paymentDue ?? "",
      paymentMethod: overrides.paymentMethod ?? "",
      usage,
    })
  );
  return {
    campaignId: campaign.id,
    brand: "Acme",
    brandId: null,
    campaign: "Launch",
    deliverables: "1 Organic Reel",
    date: "01/05/2026",
    uploadDate: "",
    status: campaign.status,
    amount,
    barterValue,
    total: amount + barterValue,
    invoiceRef: "",
    invoiceId: null,
    paymentStatus: campaign.paymentStatus,
    paymentDue: campaign.paymentDue,
    paidDate: campaign.paidDate,
    paymentMethod: campaign.paymentMethod,
    ...overrides,
    settlement: campaign.settlement,
    barterState: campaign.barterState,
    usage: campaign.usage,
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
