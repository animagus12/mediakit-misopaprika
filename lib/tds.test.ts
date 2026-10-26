import { afterEach, describe, expect, it, vi } from "vitest";
import { makeCampaign, makeRenewal, makeUsage } from "@/lib/testing/fixtures";
import { calculateTdsAmount, summarizeTds, tdsFinancialYears } from "./tds";

afterEach(() => {
  vi.useRealTimers();
});

describe("calculateTdsAmount", () => {
  it("takes the rate as a percentage of cash, rounded to the rupee", () => {
    expect(calculateTdsAmount(10000, 10)).toBe(1000);
    expect(calculateTdsAmount(12345, 10)).toBe(1235);
    expect(calculateTdsAmount(9999, 2)).toBe(200);
  });

  it("is zero for no cash, no rate, negatives and non-finite input", () => {
    expect(calculateTdsAmount(0, 10)).toBe(0);
    expect(calculateTdsAmount(10000, 0)).toBe(0);
    expect(calculateTdsAmount(-500, 10)).toBe(0);
    expect(calculateTdsAmount(10000, -1)).toBe(0);
    expect(calculateTdsAmount(Number.NaN, 10)).toBe(0);
    expect(calculateTdsAmount(10000, Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("tdsFinancialYears", () => {
  it("always offers the current year, even with no TDS recorded", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-27T06:00:00.000Z"));
    expect(tdsFinancialYears([])).toEqual([2026]);
  });

  it("adds each year with received, dated, TDS-bearing payments, newest first and once each", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-27T06:00:00.000Z"));
    const years = tdsFinancialYears([
      makeCampaign({ id: "A", paidDate: "15/03/2025", tdsRate: 10 }),
      makeCampaign({ id: "B", paidDate: "15/04/2025", tdsAmount: 500 }),
      makeCampaign({ id: "C", paidDate: "20/04/2025", tdsRate: 2 }),
      makeCampaign({ id: "D", paidDate: "20/04/2023", tdsRate: 10, paymentStatus: "pending" }),
      makeCampaign({ id: "E", paidDate: "", tdsRate: 10 }),
      makeCampaign({ id: "F", paidDate: "20/04/2022" }),
    ]);

    expect(years).toEqual([2026, 2025, 2024]);
  });
});

describe("summarizeTds", () => {
  it("uses the actual amount when one is entered and estimates from the rate otherwise", () => {
    const summary = summarizeTds(
      [
        makeCampaign({ id: "A", brand: "Acme", amount: 20000, paidDate: "10/05/2026", tdsRate: 10, tdsAmount: 1800 }),
        makeCampaign({ id: "B", brand: "Beta", amount: 15000, paidDate: "12/05/2026", tdsRate: 10 }),
      ],
      2026
    );

    expect(summary.payments).toEqual([
      {
        campaignId: "B",
        campaign: "Launch",
        brand: "Beta",
        paidDate: "12/05/2026",
        cashAmount: 15000,
        tdsRate: 10,
        tdsAmount: 1500,
        estimated: true,
      },
      {
        campaignId: "A",
        campaign: "Launch",
        brand: "Acme",
        paidDate: "10/05/2026",
        cashAmount: 20000,
        tdsRate: 10,
        tdsAmount: 1800,
        estimated: false,
      },
    ]);
    expect(summary.totalCash).toBe(35000);
    expect(summary.totalTds).toBe(3300);
  });

  it("estimates on cash including the usage fee, never on barter", () => {
    const summary = summarizeTds(
      [
        makeCampaign({
          type: "Barter+Paid",
          amount: 10000,
          barterValue: 5000,
          usage: makeUsage({ fee: 2000 }),
          paidDate: "10/05/2026",
          tdsRate: 10,
        }),
      ],
      2026
    );

    expect(summary.payments[0]).toMatchObject({ cashAmount: 12000, tdsAmount: 1200, estimated: true });
  });

  it("includes a zero rate as an estimate of nothing", () => {
    const summary = summarizeTds([makeCampaign({ paidDate: "10/05/2026", tdsRate: 0 })], 2026);

    expect(summary.payments[0]).toMatchObject({ tdsRate: 0, tdsAmount: 0, estimated: true });
  });

  it("files payments by paid date across the 31 March / 1 April boundary", () => {
    const campaigns = [
      makeCampaign({ id: "A", paidDate: "31/03/2026", tdsAmount: 100 }),
      makeCampaign({ id: "B", paidDate: "01/04/2026", tdsAmount: 200 }),
    ];

    expect(summarizeTds(campaigns, 2025).payments.map((p) => p.campaignId)).toEqual(["A"]);
    expect(summarizeTds(campaigns, 2026).payments.map((p) => p.campaignId)).toEqual(["B"]);
  });

  it("leaves out pending, undated and TDS-free payments", () => {
    const summary = summarizeTds(
      [
        makeCampaign({ id: "A", paymentStatus: "pending", paidDate: "10/05/2026", tdsRate: 10 }),
        makeCampaign({ id: "B", paymentStatus: "unknown", paidDate: "10/05/2026", tdsRate: 10 }),
        makeCampaign({ id: "C", paidDate: "", tdsRate: 10 }),
        makeCampaign({ id: "D", paidDate: "10/05/2026" }),
        makeCampaign({ id: "E", paidDate: "not a date", tdsRate: 10 }),
      ],
      2026
    );

    expect(summary.payments).toEqual([]);
    expect(summary.totalCash).toBe(0);
    expect(summary.totalTds).toBe(0);
  });

  // Current behaviour: renewal fees carry no TDS fields and are never read
  // here. Step 6 adds TDS on renewals.
  it("ignores usage renewal money", () => {
    const renewals = [makeRenewal({ amount: 5000, paidDate: "15/06/2026" })];
    const summary = summarizeTds(
      [makeCampaign({ amount: 10000, paidDate: "10/05/2026", tdsRate: 10, usage: makeUsage({ renewals }) })],
      2026
    );

    expect(summary.totalCash).toBe(10000);
    expect(summary.totalTds).toBe(1000);
  });

  it("files a yyyy-mm-dd paid date by its financial year too", () => {
    const campaigns = [
      makeCampaign({ id: "A", paidDate: "2026-03-31", tdsAmount: 100 }),
      makeCampaign({ id: "B", paidDate: "2026-04-01", tdsAmount: 200 }),
    ];

    expect(summarizeTds(campaigns, 2025).payments.map((p) => p.campaignId)).toEqual(["A"]);
    expect(summarizeTds(campaigns, 2026).payments.map((p) => p.campaignId)).toEqual(["B"]);
  });

  it("sorts payments newest first across both date formats", () => {
    const summary = summarizeTds(
      [
        makeCampaign({ id: "A", paidDate: "05/06/2026", tdsAmount: 1 }),
        makeCampaign({ id: "B", paidDate: "2026-07-01", tdsAmount: 1 }),
        makeCampaign({ id: "C", paidDate: "2026-05-20", tdsAmount: 1 }),
      ],
      2026
    );

    expect(summary.payments.map((p) => p.campaignId)).toEqual(["B", "A", "C"]);
  });

  it("sorts payments newest first, then by brand", () => {
    const summary = summarizeTds(
      [
        makeCampaign({ id: "A", brand: "Zeta", paidDate: "05/06/2026", tdsAmount: 1 }),
        makeCampaign({ id: "B", brand: "Alpha", paidDate: "05/06/2026", tdsAmount: 1 }),
        makeCampaign({ id: "C", brand: "Mid", paidDate: "20/12/2026", tdsAmount: 1 }),
        makeCampaign({ id: "D", brand: "Old", paidDate: "1/5/2026", tdsAmount: 1 }),
      ],
      2026
    );

    expect(summary.payments.map((p) => p.campaignId)).toEqual(["C", "B", "A", "D"]);
  });

  it("totals TDS per brand, largest first, with blank brands grouped", () => {
    const summary = summarizeTds(
      [
        makeCampaign({ id: "A", brand: "Acme", paidDate: "10/05/2026", tdsAmount: 300 }),
        makeCampaign({ id: "B", brand: "Acme ", paidDate: "11/05/2026", tdsAmount: 200 }),
        makeCampaign({ id: "C", brand: "Beta", paidDate: "12/05/2026", tdsAmount: 900 }),
        makeCampaign({ id: "D", brand: "  ", paidDate: "13/05/2026", tdsAmount: 100 }),
      ],
      2026
    );

    expect(summary.brands).toEqual([
      { brand: "Beta", paymentCount: 1, tdsAmount: 900 },
      { brand: "Acme", paymentCount: 2, tdsAmount: 500 },
      { brand: "Unknown brand", paymentCount: 1, tdsAmount: 100 },
    ]);
  });
});
