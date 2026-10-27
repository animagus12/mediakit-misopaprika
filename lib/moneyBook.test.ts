import { describe, expect, it } from "vitest";
import { ledgerCampaigns, makeCampaignRecord, makeInvoice, makePaymentRecord } from "@/lib/testing/fixtures";
import type { AffiliatePayout } from "@/repositories/affiliatePayouts";
import type { OutflowRow } from "./expenses";
import {
  cashOwedToYou,
  commissionRows,
  entryCategory,
  entryDetail,
  entryFlags,
  entryHref,
  entryKey,
  entryTitle,
  filterEntries,
  flowsByMonth,
  flowsByYear,
  moneyEntries,
  moneyYears,
  parseMoneyFlow,
  sumFlows,
  type CommissionRow,
} from "./moneyBook";
import type { LedgerRow } from "./payments";

function payment(overrides: Partial<LedgerRow> = {}): LedgerRow {
  return {
    paymentId: "p1",
    target: { kind: "deal", campaignId: "D1" },
    fy: 2026,
    date: "2026-10-10",
    bucketDate: "2026-10-10",
    brand: "Blinkit",
    targetLabel: "Rakhi",
    deal: "Rakhi",
    gross: 10000,
    tds: 1000,
    fee: 18,
    net: 8982,
    receivedInto: "business",
    method: "UPI",
    reference: "UTR1",
    origin: "recorded",
    source: "stored",
    ...overrides,
  };
}

function outflow(overrides: Partial<OutflowRow> = {}): OutflowRow {
  return {
    id: "e1",
    source: "expense",
    date: "2026-10-12",
    estimated: false,
    fy: 2026,
    amount: 1200,
    category: "props",
    description: "Hot Wheels set",
    editor: null,
    campaignId: "D1",
    dealLabel: "Blinkit · Rakhi",
    paidBy: "ritika",
    settlement: null,
    method: "UPI",
    receiptUrl: null,
    note: "",
    ...overrides,
  };
}

function commission(overrides: Partial<CommissionRow> = {}): CommissionRow {
  return {
    id: "c1",
    date: "2026-09-30",
    estimated: false,
    fy: 2026,
    amount: 600,
    partner: "Amazon",
    period: "01/09/2026 to 30/09/2026",
    method: null,
    ...overrides,
  };
}

function payout(overrides: Partial<AffiliatePayout> = {}): AffiliatePayout {
  return {
    id: "po1",
    partnerId: "amz",
    periodStart: "01/09/2026",
    periodEnd: "30/09/2026",
    grossSales: 12000,
    salesCount: 4,
    commissionAmount: 600,
    paymentStatus: "received",
    paidDate: "05/10/2026",
    paymentMethod: "bank transfer",
    ...overrides,
  };
}

const entries = moneyEntries(
  [payment(), payment({ paymentId: "p-old", date: "2026-03-31", bucketDate: "2026-03-31", fy: 2025, gross: 5000, tds: 0, fee: 0, net: 5000 })],
  [commission()],
  [outflow(), outflow({ id: "et1", source: "editing", category: "editing", amount: 400, date: "2026-04-01", fy: 2026, paidBy: "business", description: "Reel", editor: "Divyanshu" })]
);

describe("commissionRows", () => {
  it("lists received payouts by the day paid, else the period's end flagged as estimated", () => {
    const rows = commissionRows(
      [payout(), payout({ id: "po2", paidDate: "", periodEnd: "31/08/2026" }), payout({ id: "po3", paymentStatus: "pending" })],
      [{ id: "amz", name: "Amazon" }],
      "Affiliate"
    );
    expect(rows.map((row) => [row.id, row.date, row.estimated, row.partner, row.method])).toEqual([
      ["po1", "2026-10-05", false, "Amazon", "Bank transfer"],
      ["po2", "2026-08-31", true, "Amazon", "Bank transfer"],
    ]);
    expect(commissionRows([payout({ partnerId: "gone" })], [], "Affiliate")[0].partner).toBe("Affiliate");
  });
});

describe("one list", () => {
  it("merges every kind newest first, each with its own key", () => {
    expect(entries.map(entryKey)).toEqual(["expense:e1", "payment:p1", "commission:c1", "editing:et1", "payment:p-old"]);
  });

  it("filters by direction and by financial year, and offers the years present", () => {
    expect(filterEntries(entries, { flow: "out", fy: null }).map(entryKey)).toEqual(["expense:e1", "editing:et1"]);
    expect(filterEntries(entries, { flow: null, fy: 2025 }).map(entryKey)).toEqual(["payment:p-old"]);
    expect(moneyYears(entries, new Date("2026-10-28T06:00:00Z"))).toEqual([2026, 2025]);
    expect([parseMoneyFlow("in"), parseMoneyFlow("out"), parseMoneyFlow("all"), parseMoneyFlow(undefined)]).toEqual([
      "in",
      "out",
      null,
      null,
    ]);
  });

  it("names each entry the same way wherever it is shown", () => {
    const [expense, brand, programme, editing] = entries;
    expect([entryCategory(brand), entryTitle(brand), entryDetail(brand), entryHref(brand)]).toEqual([
      "Brand payment",
      "Blinkit",
      "Rakhi",
      "/campaigns?q=Rakhi",
    ]);
    expect([entryCategory(programme), entryDetail(programme), entryHref(programme)]).toEqual([
      "Affiliate commission",
      "Commission for 01/09/2026 to 30/09/2026",
      "/affiliates",
    ]);
    expect([entryCategory(editing), entryDetail(editing), entryHref(editing), entryFlags(editing)]).toEqual([
      "Editing",
      "Divyanshu · Blinkit · Rakhi",
      "/workspace",
      ["From Editor workspace"],
    ]);
    expect([entryCategory(expense), entryDetail(expense), entryHref(expense)]).toEqual(["Props", "Blinkit · Rakhi", null]);
  });
});

describe("cash flow and profit", () => {
  it("counts what landed as cash and adds TDS and barter back for profit", () => {
    const totals = sumFlows(entries, 3000);
    expect(totals).toEqual({
      cashIn: 14582, // 8,982 + 5,000 landed + 600 commission
      cashOut: 1600,
      netCash: 12982,
      gross: 15000,
      tds: 1000,
      fees: 18,
      commission: 600,
      barter: 3000,
      income: 18600,
      costs: 1618,
      profit: 16982,
    });
    expect(totals.profit).toBe(totals.netCash + totals.tds + totals.barter);
  });

  it("breaks it down by month and by financial year, barter-only months included", () => {
    const barter = new Map([
      ["2026-10", 500],
      ["2026-07", 900],
    ]);
    expect(flowsByMonth(entries, barter).map((row) => [row.period, row.cashIn, row.cashOut, row.profit])).toEqual([
      // 10,000 gross + 500 barter, less 1,200 spent and 18 in charges.
      ["2026-10", 8982, 1200, 9282],
      ["2026-09", 600, 0, 600],
      ["2026-07", 0, 0, 900],
      ["2026-04", 0, 400, -400],
      ["2026-03", 5000, 0, 5000],
    ]);
    const years = flowsByYear(entries, barter);
    expect(years.map((row) => [row.period, row.netCash, row.profit])).toEqual([
      ["2026", 7982, 10382], // 7,982 net cash + 1,000 TDS + 1,400 barter
      ["2025", 5000, 5000],
    ]);
    for (const row of years) expect(row.profit).toBe(row.netCash + row.tds + row.barter);
  });
});

describe("cashOwedToYou", () => {
  it("adds what is left on expected deals, sent standalone invoices and pending commission", () => {
    const campaigns = ledgerCampaigns(
      [
        makeCampaignRecord({ id: "D1", amount: 10000, paymentStatus: "pending" }),
        makeCampaignRecord({ id: "D2", amount: 5000, paymentStatus: "pending", status: "Cancelled" }),
        makeCampaignRecord({ id: "D3", amount: 4000, paymentStatus: "received" }),
      ],
      [],
      [makePaymentRecord({ id: "5f0c6f1e-2b7a-4c1d-9a3e-000000000009", target: { kind: "deal", campaignId: "D1" }, gross: 2500 })]
    );
    const owed = cashOwedToYou(
      campaigns,
      [makeInvoice({ id: "solo", status: "sent", items: [{ desc: "Reel", sub: "", qty: 1, price: 3000 }] }), makeInvoice({ id: "draft", status: "draft" })],
      [payout({ paymentStatus: "pending", commissionAmount: 450 })]
    );
    expect(owed).toBe(7500 + 3000 + 450);
  });
});
