import { describe, expect, it } from "vitest";
import { financialYearOfMonth } from "@/lib/financialYear";
import { sumMoney } from "@/lib/money";
import {
  ledgerCampaigns,
  makeCampaignRecord,
  makeInvoiceRecord,
  makePaymentRecord,
  makeRenewal,
  makeUsage,
} from "@/lib/testing/fixtures";
import { summarizeEarnings } from "@/repositories/earnings";
import { toInvoice } from "@/repositories/invoices";
import { attachInvoiceSettlements, ledgerRows, sumLedgerRows } from "./payments";

// One book with every kind of money in it: a legacy received deal, a deal paid
// in two instalments either side of 31 March, a called-off deal with a kill
// fee, renewals legacy and recorded, a linked invoice's advance, standalone
// invoices recorded and marked paid by hand, and a payment with no date at all.
const records = [
  makeCampaignRecord({ id: "A", campaign: "Legacy", amount: 10000, paidDate: "15/03/2027" }),
  makeCampaignRecord({ id: "B", campaign: "Split", amount: 10000, paymentStatus: "pending" }),
  makeCampaignRecord({ id: "C", campaign: "Called off", status: "Cancelled", amount: 8000, paidDate: "01/10/2026" }),
  makeCampaignRecord({
    id: "D",
    campaign: "Licensed",
    amount: 5000,
    paymentStatus: "pending",
    usage: makeUsage({
      days: 30,
      renewals: [
        makeRenewal({ id: "R0001", amount: 3000, paidDate: "10/06/2026" }),
        makeRenewal({ id: "R0002", amount: 2000, paymentStatus: "pending" }),
      ],
    }),
  }),
  makeCampaignRecord({ id: "E", campaign: "Advance", amount: 6000, paymentStatus: "pending", invoiceId: "inv-linked" }),
  makeCampaignRecord({ id: "G", campaign: "Undated", amount: 1000, date: "" }),
];
const invoiceRecords = [
  makeInvoiceRecord({ id: "inv-linked", invoiceNo: "0005", advance: 1500, issueDate: "2026-08-01" }),
  makeInvoiceRecord({ id: "inv-own", invoiceNo: "0007", client: { name: "Solo", contactName: "", email: "" } }),
  makeInvoiceRecord({ id: "inv-legacy", invoiceNo: "0008", status: "paid" }),
];
const payments = [
  makePaymentRecord({ id: "b1", target: { kind: "deal", campaignId: "B" }, date: "2027-03-31", gross: 4000, tds: 400, bankFee: 18 }),
  makePaymentRecord({ id: "b2", target: { kind: "deal", campaignId: "B" }, date: "2027-04-01", gross: 6000 }),
  makePaymentRecord({ id: "c1", target: { kind: "deal", campaignId: "C" }, date: "2026-10-30", gross: 2000 }),
  makePaymentRecord({ id: "r2", target: { kind: "renewal", campaignId: "D", renewalId: "R0002" }, date: "2026-12-01", gross: 1500 }),
  makePaymentRecord({ id: "i1", target: { kind: "invoice", invoiceId: "inv-own" }, date: "2026-11-11", gross: 5000 }),
];

const campaigns = ledgerCampaigns(records, invoiceRecords, payments);
const invoices = attachInvoiceSettlements(invoiceRecords.map(toInvoice), campaigns, payments);
const rows = ledgerRows(campaigns, invoices);
const earnings = summarizeEarnings(campaigns, [], invoices);

describe("ledgerRows", () => {
  it("adds up to earnings' cash for every financial year, and in total", () => {
    const years = new Set(rows.map((row) => row.fy).filter((fy): fy is number => fy !== null));
    expect([...years].sort()).toEqual([2026, 2027]);
    for (const year of years) {
      const fromRows = sumLedgerRows(rows.filter((row) => row.fy === year)).gross;
      const fromEarnings = sumMoney(
        earnings.monthly.filter((month) => financialYearOfMonth(month.month) === year).map((month) => month.paid)
      );
      expect(fromRows, `FY ${year}`).toBe(fromEarnings);
    }
    expect(sumLedgerRows(rows).gross).toBe(earnings.paid);
  });

  it("files each instalment in the year it arrived, 31 March and 1 April either side", () => {
    expect(rows.filter((row) => row.target.kind === "deal" && row.deal === "Split").map((row) => [row.date, row.fy])).toEqual([
      ["2027-04-01", 2027],
      ["2027-03-31", 2026],
    ]);
  });

  it("leaves out the legacy money earnings leaves out, and keeps what was recorded", () => {
    const ids = rows.map((row) => row.paymentId);
    // A called-off deal's legacy "received", and a standalone invoice marked paid by hand.
    expect(ids).not.toContain("legacy:status:deal:C");
    expect(ids).not.toContain("legacy:status:invoice:inv-legacy");
    // Its kill fee, a standalone invoice's recorded payment, and a linked invoice's advance on its deal.
    expect(ids).toEqual(expect.arrayContaining(["c1", "i1", "legacy:advance:deal:E"]));
  });

  it("names what each payment was for, and the deal to find it under", () => {
    const byId = new Map(rows.map((row) => [row.paymentId, row]));
    expect(byId.get("b1")).toMatchObject({ brand: "Acme", targetLabel: "Split", deal: "Split", tds: 400, fee: 18, net: 3582 });
    expect(byId.get("r2")).toMatchObject({ targetLabel: "Licensed · usage renewal", deal: "Licensed" });
    expect(byId.get("i1")).toMatchObject({ brand: "Solo", targetLabel: "Invoice MSP-INV-0007", deal: null });
    expect(byId.get("legacy:status:deal:A")).toMatchObject({ origin: "legacy", source: "virtual", date: "2027-03-15" });
  });

  it("keeps an undated payment out of every year but in the total", () => {
    const undated = rows.find((row) => row.paymentId === "legacy:status:deal:G");
    expect(undated).toMatchObject({ date: "", bucketDate: "", fy: null, gross: 1000 });
  });

  it("lists the newest first", () => {
    const dated = rows.map((row) => row.bucketDate).filter(Boolean);
    expect(dated).toEqual([...dated].sort().reverse());
  });
});

describe("summarizeEarnings with standalone invoices", () => {
  it("counts a payment recorded on one in the month it arrived, under the invoice's number", () => {
    const november = earnings.monthly.find((month) => month.month === "2026-11");
    expect(november?.paid).toBe(5000);
    expect(november?.deals).toEqual([{ brand: "Solo", amount: 5000, deliverables: "Invoice MSP-INV-0007" }]);
  });

  it("never counts one marked paid by hand, nor a linked invoice twice", () => {
    const withInvoices = summarizeEarnings(campaigns, [], invoices).paid;
    const dealsOnly = summarizeEarnings(campaigns).paid;
    expect(withInvoices - dealsOnly).toBe(5000);
  });
});
