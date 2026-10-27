// Golden figures for every money report the payment ledger feeds.
//
// Written before the ledger existed, against the code as it stood, and
// snapshotted. The ledger's first stage joins settlements onto every deal,
// renewal and invoice but projects them so that a book with no recorded
// payments reads exactly as before: these snapshots are what holds it to
// that. A later stage that moves a figure on purpose updates the snapshot and
// says why, next to the change.
//
// Two books are run: the bundled seed, and a fixture book built to reach the
// cases the seed does not (dated payments, invoice advances, renewals, a
// called-off deal carrying TDS, both barter shapes).
import { describe, expect, it, vi } from "vitest";
import campaignsSeed from "@/data/campaigns.json";
import invoicesSeed from "@/data/invoices.json";
import {
  computeBrandStats,
  selectDuePayments,
  summarizeDuePayments,
} from "@/lib/brandCampaignStats";
import { computePipelineStats, type BrandRow } from "@/lib/brands";
import { computeCollectionLag, computeMonthForecast } from "@/lib/cashTiming";
import { computeInvoiceStats } from "@/lib/invoice";
import { computePaymentReliability } from "@/lib/paymentReliability";
import { attachInvoiceSettlements } from "@/lib/payments";
import { summarizeTds, tdsFinancialYears } from "@/lib/tds";
import {
  ledgerCampaigns,
  makeCampaignRecord,
  makeInvoiceRecord,
  makeRenewal,
  makeUsage,
} from "@/lib/testing/fixtures";
import { renewalTotal, usageTerm } from "@/lib/usageRights";
import { toBrandCampaignRecord } from "@/repositories/brandCampaigns";
import type { Campaign, CampaignRecord } from "@/repositories/campaigns";
import { summarizeEarnings } from "@/repositories/earnings";
import { toInvoice, type Invoice, type InvoiceRecord } from "@/repositories/invoices";

vi.mock("@/repositories/campaigns.writer.server", () => ({
  getCampaigns: () => {
    throw new Error("tests must not read the store");
  },
}));
vi.mock("@/repositories/affiliatePartners.writer.server", () => ({
  getAffiliatePartners: () => {
    throw new Error("tests must not read the store");
  },
}));
vi.mock("@/repositories/affiliatePayouts.writer.server", () => ({
  getAffiliatePayouts: () => {
    throw new Error("tests must not read the store");
  },
}));

const NOW = new Date("2026-10-27T06:00:00.000Z");

/**
 * The read join every page sees, as the repositories build it
 * (readCampaignLedger, getInvoices), over an empty payments store: the state
 * of every book before its first recorded payment.
 */
function readJoin(records: CampaignRecord[], invoiceRecords: InvoiceRecord[]) {
  const campaigns: Campaign[] = ledgerCampaigns(records, invoiceRecords, []);
  const invoices: Invoice[] = attachInvoiceSettlements(invoiceRecords.map(toInvoice), campaigns, []);
  return { campaigns, invoices };
}

function report(records: CampaignRecord[], invoiceRecords: InvoiceRecord[]) {
  const { campaigns, invoices } = readJoin(records, invoiceRecords);
  const brandRecords = campaigns.filter((campaign) => campaign.brand.trim()).map(toBrandCampaignRecord);
  const brands = [...new Set(brandRecords.map((record) => record.brand))].sort();
  const due = selectDuePayments(brandRecords, NOW);

  return {
    earnings: summarizeEarnings(campaigns),
    tds: tdsFinancialYears(campaigns, NOW).map((year) => ({ year, summary: summarizeTds(campaigns, year) })),
    brandStats: brands.map((brand) => ({
      brand,
      stats: computeBrandStats(brandRecords.filter((record) => record.brand === brand)),
    })),
    collectionLag: computeCollectionLag(brandRecords),
    forecast: computeMonthForecast(campaigns, 0, NOW),
    reliability: computePaymentReliability(brandRecords, NOW),
    due: due.map(({ record, ...entry }) => ({ campaignId: record.campaignId, ...entry })),
    dueSummary: summarizeDuePayments(due),
    invoiceStats: computeInvoiceStats(invoices, NOW),
    invoices: invoices.map((invoice) => ({
      id: invoice.id,
      status: invoice.status,
      subtotal: invoice.subtotal,
      balanceDue: invoice.balanceDue,
    })),
    renewals: campaigns
      .filter((campaign) => campaign.usage.renewals.length > 0)
      .map((campaign) => {
        const term = usageTerm(campaign, NOW);
        return {
          id: campaign.id,
          total: renewalTotal(campaign.usage),
          received: term.renewalReceived,
          pending: term.renewalPending,
        };
      }),
    // What a deal says about its own payment, field by field. The ledger's
    // projection must leave every one of these as stored.
    paymentFields: campaigns.map((campaign) => ({
      id: campaign.id,
      paymentStatus: campaign.paymentStatus,
      paidDate: campaign.paidDate,
      paymentMethod: campaign.paymentMethod,
      tdsAmount: campaign.tdsAmount,
      paymentDue: campaign.paymentDue,
      renewals: campaign.usage.renewals.map((renewal) => ({
        id: renewal.id,
        paymentStatus: renewal.paymentStatus,
        paidDate: renewal.paidDate,
        paymentMethod: renewal.paymentMethod,
        tdsAmount: renewal.tdsAmount,
        paymentDue: renewal.paymentDue,
      })),
    })),
  };
}

const invoiceRecord = makeInvoiceRecord;
const fixtureRecord = makeCampaignRecord;

const FIXTURE_INVOICES: InvoiceRecord[] = [
  // Bills F2, with an advance taken before the deal was paid.
  invoiceRecord({
    id: "inv-adv",
    invoiceNo: "0009",
    status: "sent",
    issueDate: "2026-09-01",
    dueDate: "2026-10-15",
    items: [{ desc: "Reel", sub: "", qty: 1, price: 60000 }],
    advance: 20000,
  }),
  // Bills F3's second renewal, with an advance of its own.
  invoiceRecord({
    id: "inv-ren",
    invoiceNo: "0010",
    status: "sent",
    issueDate: "2026-10-01",
    dueDate: "2026-10-20",
    items: [{ desc: "Usage", sub: "", qty: 1, price: 8000 }],
    advance: 3000,
  }),
  // Marked paid while the deal it bills (F11) is still pending.
  invoiceRecord({
    id: "inv-lp",
    invoiceNo: "0011",
    status: "paid",
    issueDate: "2026-09-10",
    dueDate: "2026-10-01",
    items: [{ desc: "Reel", sub: "", qty: 1, price: 9000 }],
  }),
  // Standalone: paid, void, draft, and sent with an advance.
  invoiceRecord({ id: "inv-sa", invoiceNo: "0012", status: "paid", issueDate: "2026-08-01", dueDate: "2026-08-15" }),
  invoiceRecord({ id: "inv-void", invoiceNo: "0013", status: "void", advance: 500 }),
  invoiceRecord({ id: "inv-draft", invoiceNo: "0014", status: "draft", dueDate: "2026-09-01" }),
  invoiceRecord({
    id: "inv-sa-adv",
    invoiceNo: "0015",
    status: "sent",
    issueDate: "2026-10-05",
    dueDate: "2026-11-05",
    items: [{ desc: "Workshop", sub: "", qty: 1, price: 15000 }],
    advance: 5000,
  }),
];

const FIXTURE_CAMPAIGNS: CampaignRecord[] = [
  fixtureRecord({
    id: "F1",
    brand: "Acme",
    amount: 25000,
    paymentStatus: "received",
    paidDate: "02/09/2026",
    uploadDate: "14/08/2026",
    paymentDue: "20/08/2026",
    paymentMethod: "UPI",
    tdsRate: 10,
  }),
  fixtureRecord({
    id: "F2",
    brand: "Acme",
    amount: 60000,
    paymentStatus: "pending",
    uploadDate: "05/09/2026",
    invoiceRef: "MSP-INV-0009",
    invoiceId: "inv-adv",
    tdsRate: 10,
  }),
  fixtureRecord({
    id: "F3",
    brand: "Beta",
    amount: 30000,
    paymentStatus: "received",
    paidDate: "10/07/2026",
    uploadDate: "01/07/2026",
    paymentDue: "05/07/2026",
    usage: makeUsage({
      days: 30,
      renewals: [
        makeRenewal({ id: "R0001", amount: 5000, paymentStatus: "received", paidDate: "15/08/2026", startDate: "31/07/2026", tdsRate: 10 }),
        makeRenewal({ id: "R0002", amount: 8000, paymentStatus: "pending", paidDate: "", startDate: "30/08/2026", paymentDue: "20/10/2026", invoiceId: "inv-ren" }),
        makeRenewal({ id: "R0003", amount: 0, paymentStatus: "unknown", paidDate: "", startDate: "29/09/2026" }),
      ],
    }),
  }),
  fixtureRecord({
    id: "F4",
    brand: "Gamma",
    status: "Cancelled",
    amount: 15000,
    paymentStatus: "received",
    paidDate: "01/06/2026",
    tdsAmount: 1500,
  }),
  fixtureRecord({
    id: "F5",
    brand: "Beta",
    type: "Barter+Paid",
    amount: 12000,
    barterValue: 4000,
    paymentStatus: "received",
    uploadDate: "20/09/2026",
    tdsRate: 10,
  }),
  fixtureRecord({
    id: "F6",
    brand: "Beta",
    type: "Barter+Paid",
    amount: 8000,
    barterValue: 3000,
    paymentStatus: "pending",
    uploadDate: "02/10/2026",
    paymentDue: "25/10/2026",
  }),
  fixtureRecord({
    id: "F7",
    brand: "Delta",
    type: "Barter",
    amount: 0,
    barterValue: 5000,
    paymentStatus: "received",
    paidDate: "03/09/2026",
    uploadDate: "28/08/2026",
  }),
  fixtureRecord({ id: "F8", brand: "Delta", amount: 7000, paymentStatus: "unknown", uploadDate: "10/10/2026" }),
  fixtureRecord({
    id: "F9",
    brand: "Echo",
    type: "UGC Ad",
    amount: 20000,
    usage: makeUsage({ days: 30, fee: 5000 }),
    paymentStatus: "received",
    paidDate: "31/03/2027",
    uploadDate: "15/03/2027",
    paymentDue: "30/03/2027",
    paymentMethod: "Bank transfer",
    tdsAmount: 2500,
  }),
  fixtureRecord({
    id: "F10",
    brand: "Echo",
    amount: 18000,
    paymentStatus: "received",
    paidDate: "01/04/2027",
    uploadDate: "20/03/2027",
    paymentDue: "05/04/2027",
    tdsRate: 10,
  }),
  fixtureRecord({
    id: "F11",
    brand: "Gamma",
    amount: 9000,
    paymentStatus: "pending",
    uploadDate: "05/09/2026",
    invoiceRef: "MSP-INV-0011",
    invoiceId: "inv-lp",
  }),
  fixtureRecord({ id: "F12", brand: "Scamco", type: "Scam", amount: 4000, paymentStatus: "pending", uploadDate: "01/09/2026" }),
];

describe("ledger parity: money reports", () => {
  it("matches the golden figures on the bundled seed", () => {
    expect(report(campaignsSeed as CampaignRecord[], invoicesSeed as InvoiceRecord[])).toMatchSnapshot();
  });

  // Stage 2 (reports read settlements) moved these figures on purpose:
  //   N1  Deal cash is filed by the day the money arrived: F1 moves from
  //       2026-08 (posted) to 2026-09 (paid), F10 from 2027-03 to 2027-04.
  //   N2  An invoice advance on a deal or renewal still pending counts as
  //       received: F2's ₹20,000 (2026-09) and R0002's ₹3,000 (2026-10) move
  //       out of pending, brand pending and payments due, into paid.
  //   N3  A linked invoice follows its deal (inv-lp reads sent while F11 is
  //       pending), and a paid or void invoice owes nothing (inv-sa, inv-void).
  //   N5  Pending, payments due and owed renewals count what is still owed.
  //   Scam deals owe no cash, so F12's ₹4,000 is no longer pending.
  //   Months gain tds, fees and net (paid = net + tds + fees); TDS rows are
  //   one per payment, dated as day keys. Seed: the one ₹0 Miniso row drops
  //   out of its month's deal list.
  it("matches the golden figures on the fixture book", () => {
    expect(report(FIXTURE_CAMPAIGNS, FIXTURE_INVOICES)).toMatchSnapshot();
  });

  // The one figure stage 1 moves on purpose (N4): the /brands revenue tile
  // summed totalReceived, which counts delivered barter at its value, in the
  // cash colour. It now sums cash received only.
  it("counts only cash in the brands revenue tile", () => {
    const { campaigns } = readJoin(FIXTURE_CAMPAIGNS, FIXTURE_INVOICES);
    const records = campaigns.map(toBrandCampaignRecord);
    const beta = computeBrandStats(records.filter((record) => record.brand === "Beta"));
    const row: BrandRow = {
      id: "brand-beta",
      name: "Beta",
      logoUrl: null,
      status: "Worked With",
      agencyName: null,
      contactName: null,
      campaignCount: beta.campaignCount,
      revenue: beta.totalBilled,
      lastCollabDate: beta.lastCollabDate,
      missingDetails: null,
      searchText: "beta",
    };
    const stats = computePipelineStats([row], new Map([["Beta", beta]]));
    expect(beta.totalReceived - beta.cashReceived).toBe(4000); // F5's barter
    expect(stats.totalRevenue).toBe(beta.cashReceived);
  });
});
