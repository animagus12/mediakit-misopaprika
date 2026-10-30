import { describe, expect, it } from "vitest";
import {
  ledgerCampaigns,
  makeCampaignRecord,
  makeInvoiceRecord,
  makePaymentRecord,
  makeRenewal,
  makeUsage,
} from "@/lib/testing/fixtures";
import { toBrandCampaignRecord } from "@/repositories/brandCampaigns";
import { toInvoice } from "@/repositories/invoices";
import { selectAttentionItems } from "./dashboardAttention";
import { attachInvoiceSettlements } from "./payments";

const NOW = new Date("2026-10-27T06:00:00.000Z");

// A deal, one of its renewals and a standalone invoice, each paid more than
// it is worth once its amount was lowered after the money was recorded.
const campaignRecords = [
  makeCampaignRecord({
    id: "MSP-MC0007",
    brand: "Acme",
    campaign: "Launch",
    amount: 10000,
    paymentStatus: "pending",
    invoiceId: "inv-deal",
    usage: makeUsage({ days: 30, renewals: [makeRenewal({ id: "R0002", amount: 3000, paymentStatus: "pending" })] }),
  }),
];
const invoiceRecords = [
  makeInvoiceRecord({ id: "inv-deal", invoiceNo: "0003" }),
  makeInvoiceRecord({ id: "inv-solo", invoiceNo: "0004", client: { name: "Solo", contactName: "", email: "" } }),
];
const payments = [
  makePaymentRecord({ id: "p-deal", target: { kind: "deal", campaignId: "MSP-MC0007" }, gross: 12000 }),
  makePaymentRecord({
    id: "p-renewal",
    target: { kind: "renewal", campaignId: "MSP-MC0007", renewalId: "R0002" },
    gross: 3500,
  }),
  makePaymentRecord({ id: "p-solo", target: { kind: "invoice", invoiceId: "inv-solo" }, gross: 10500 }),
];

const campaigns = ledgerCampaigns(campaignRecords, invoiceRecords, payments);
const records = campaigns.map(toBrandCampaignRecord);
const invoices = attachInvoiceSettlements(invoiceRecords.map(toInvoice), campaigns, payments);

describe("selectAttentionItems: payments", () => {
  it("flags each deal, renewal and standalone invoice paid more than it is worth, by how much", () => {
    const overpaid = selectAttentionItems(records, invoices, NOW).filter((item) => item.kind === "overpaid");
    expect(overpaid.map((item) => [item.campaign, item.amount, item.href])).toEqual([
      ["Launch", 2000, "/campaigns?q=Launch"],
      ["Launch · usage renewal", 500, "/campaigns?q=Launch"],
      ["Invoice MSP-INV-0004", 500, "/invoices/inv-solo"],
    ]);
  });

  it("lists money that doesn't add up before bigger follow-ups", () => {
    const overdue = makeInvoiceRecord({ id: "inv-late", invoiceNo: "0009", dueDate: "2026-09-01", items: [{ desc: "Reel", sub: "", qty: 1, price: 90000 }] });
    const withOverdue = attachInvoiceSettlements([...invoiceRecords, overdue].map(toInvoice), campaigns, payments);
    const kinds = selectAttentionItems(records, withOverdue, NOW).map((item) => item.kind);
    expect(kinds.indexOf("overdue-invoice")).toBeGreaterThan(kinds.lastIndexOf("overpaid"));
  });

  it("never flags the linked invoice, whose money is its deal's", () => {
    const items = selectAttentionItems(records, invoices, NOW);
    expect(items.some((item) => item.campaignId === "inv-deal")).toBe(false);
  });

  it("lists a payment whose deal is gone, pointing at the Payments page", () => {
    const orphan = makePaymentRecord({ id: "p-gone", target: { kind: "deal", campaignId: "MSP-MC0099" }, date: "2026-09-04", gross: 4000 });
    const items = selectAttentionItems(records, invoices, NOW, [orphan]).filter((item) => item.kind === "orphan-payment");
    expect(items).toEqual([
      {
        kind: "orphan-payment",
        campaignId: "p-gone",
        brand: "Payment for a deleted record",
        campaign: "Received 04/09/2026",
        amount: 4000,
        label: "Not linked to a deal",
        href: "/payments#unlinked",
      },
    ]);
  });
});
