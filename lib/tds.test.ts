import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ledgerCampaigns,
  makeCampaign,
  makeCampaignRecord,
  makeInvoiceRecord,
  makePaymentRecord,
  makeRenewal,
  makeUsage,
} from "@/lib/testing/fixtures";
import type { CampaignRecord, StoredUsageRenewal } from "@/repositories/campaigns";
import {
  calculateTdsAmount,
  estimateTdsFromRateInput,
  resolveTds,
  summarizeTds,
  tdsFinancialYears,
  validateTdsValues,
} from "./tds";

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
        paymentId: "legacy:status:deal:B",
        campaignId: "B",
        renewalId: null,
        source: "deal",
        campaign: "Launch",
        brand: "Beta",
        paidDate: "2026-05-12",
        gross: 15000,
        cashAmount: 15000,
        tdsRate: 10,
        tdsAmount: 1500,
        estimated: true,
      },
      {
        paymentId: "legacy:status:deal:A",
        campaignId: "A",
        renewalId: null,
        source: "deal",
        campaign: "Launch",
        brand: "Acme",
        paidDate: "2026-05-10",
        gross: 20000,
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

  it("leaves out renewals with no TDS recorded", () => {
    const renewals = [makeRenewal({ amount: 5000, paidDate: "15/06/2026" })];
    const summary = summarizeTds(
      [makeCampaign({ amount: 10000, paidDate: "10/05/2026", tdsRate: 10, usage: makeUsage({ renewals }) })],
      2026
    );

    expect(summary.payments.map((p) => p.source)).toEqual(["deal"]);
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

describe("TDS on usage renewals", () => {
  const dealWithRenewals = (renewals: StoredUsageRenewal[], deal: Partial<CampaignRecord> = {}) =>
    makeCampaign({
      id: "MSP-MC0007",
      brand: "Acme",
      campaign: "Summer",
      amount: 20000,
      paidDate: "10/05/2026",
      tdsRate: 10,
      usage: makeUsage({ days: 30, renewals }),
      ...deal,
    });

  it("lists a received renewal as its own row, marked as a renewal", () => {
    const summary = summarizeTds(
      [dealWithRenewals([makeRenewal({ id: "R0001", amount: 5000, paidDate: "15/06/2026", tdsRate: 10 })])],
      2026
    );

    expect(summary.payments).toEqual([
      {
        paymentId: "legacy:status:renewal:MSP-MC0007:R0001",
        campaignId: "MSP-MC0007",
        renewalId: "R0001",
        source: "renewal",
        campaign: "Summer",
        brand: "Acme",
        paidDate: "2026-06-15",
        gross: 5000,
        cashAmount: 5000,
        tdsRate: 10,
        tdsAmount: 500,
        estimated: true,
      },
      {
        paymentId: "legacy:status:deal:MSP-MC0007",
        campaignId: "MSP-MC0007",
        renewalId: null,
        source: "deal",
        campaign: "Summer",
        brand: "Acme",
        paidDate: "2026-05-10",
        gross: 20000,
        cashAmount: 20000,
        tdsRate: 10,
        tdsAmount: 2000,
        estimated: true,
      },
    ]);
    expect(summary.totalCash).toBe(25000);
    expect(summary.totalTds).toBe(2500);
  });

  it("uses a renewal's actual TDS over its rate", () => {
    const summary = summarizeTds(
      [dealWithRenewals([makeRenewal({ amount: 5000, paidDate: "15/06/2026", tdsRate: 10, tdsAmount: 450 })])],
      2026
    );

    expect(summary.payments.find((p) => p.source === "renewal")).toMatchObject({
      tdsAmount: 450,
      estimated: false,
    });
  });

  it("counts a renewal with TDS even when the deal itself has none", () => {
    const summary = summarizeTds(
      [
        dealWithRenewals([makeRenewal({ amount: 4000, paidDate: "15/06/2026", tdsAmount: 400 })], {
          tdsRate: null,
        }),
      ],
      2026
    );

    expect(summary.payments.map((p) => p.source)).toEqual(["renewal"]);
    expect(summary.totalTds).toBe(400);
  });

  it("files a renewal by its own paid date, not the deal's, across the 31 March / 1 April boundary", () => {
    const campaigns = [
      dealWithRenewals(
        [
          makeRenewal({ id: "R0001", amount: 3000, paidDate: "31/03/2027", tdsAmount: 300 }),
          makeRenewal({ id: "R0002", amount: 3000, paidDate: "01/04/2027", tdsAmount: 300 }),
        ],
        { paidDate: "10/05/2026" }
      ),
    ];

    expect(summarizeTds(campaigns, 2026).payments.map((p) => p.renewalId)).toEqual(["R0001", null]);
    expect(summarizeTds(campaigns, 2027).payments.map((p) => p.renewalId)).toEqual(["R0002"]);
  });

  it("leaves out pending and undated renewals", () => {
    const summary = summarizeTds(
      [
        dealWithRenewals(
          [
            makeRenewal({ id: "R0001", paymentStatus: "pending", paidDate: "15/06/2026", tdsRate: 10 }),
            makeRenewal({ id: "R0002", paidDate: "", tdsRate: 10 }),
          ],
          { tdsRate: null }
        ),
      ],
      2026
    );

    expect(summary.payments).toEqual([]);
  });

  it("adds renewals to their brand's totals", () => {
    const summary = summarizeTds(
      [
        dealWithRenewals([
          makeRenewal({ id: "R0001", amount: 5000, paidDate: "15/06/2026", tdsAmount: 500 }),
          makeRenewal({ id: "R0002", amount: 5000, paidDate: "15/07/2026", tdsAmount: 500 }),
        ]),
        makeCampaign({ id: "B", brand: "Beta", amount: 25000, paidDate: "12/05/2026", tdsAmount: 2500 }),
      ],
      2026
    );

    expect(summary.brands).toEqual([
      { brand: "Acme", paymentCount: 3, tdsAmount: 3000 },
      { brand: "Beta", paymentCount: 1, tdsAmount: 2500 },
    ]);
  });

  it("offers the financial years renewal TDS was paid in", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-27T06:00:00.000Z"));
    const years = tdsFinancialYears([
      dealWithRenewals([makeRenewal({ paidDate: "15/06/2024", tdsRate: 10 })], { tdsRate: null }),
    ]);

    expect(years).toEqual([2026, 2024]);
  });

  it("reads renewals stored before the TDS fields existed as carrying none", () => {
    const legacy: StoredUsageRenewal = {
      id: "R0001",
      startDate: "01/06/2026",
      days: 30,
      amount: 3000,
      paymentStatus: "received",
      paymentDue: "",
      paidDate: "15/06/2026",
      paymentMethod: "",
      invoiceId: "",
      recordedAt: "2026-06-01T00:00:00.000Z",
    };
    const campaign = dealWithRenewals([legacy], { tdsRate: null });

    expect(campaign.usage.renewals[0]).toMatchObject({ tdsRate: null, tdsAmount: null });
    expect(summarizeTds([campaign], 2026).payments).toEqual([]);
  });
});

describe("TDS form helpers", () => {
  it("resolves the actual amount first, then the rate's estimate, else nothing", () => {
    expect(resolveTds(10000, 10, 900)).toEqual({ amount: 900, estimated: false });
    expect(resolveTds(10000, 10, null)).toEqual({ amount: 1000, estimated: true });
    expect(resolveTds(10000, null, null)).toBeNull();
  });

  it("estimates from a typed rate only while it is between 0 and 100", () => {
    expect(estimateTdsFromRateInput("10", 5000)).toBe(500);
    expect(estimateTdsFromRateInput("  ", 5000)).toBeNull();
    expect(estimateTdsFromRateInput("101", 5000)).toBeNull();
    expect(estimateTdsFromRateInput("-1", 5000)).toBeNull();
  });

  it("rejects a rate outside 0 to 100 and a negative amount", () => {
    expect(validateTdsValues(10, 500)).toBeNull();
    expect(validateTdsValues(null, null)).toBeNull();
    expect(validateTdsValues(101, null)).toMatch(/rate/);
    expect(validateTdsValues(null, -1)).toMatch(/non-negative/);
  });
});

describe("TDS from the payment ledger", () => {
  const deal = makeCampaignRecord({ id: "D1", brand: "Acme", amount: 50000, paymentStatus: "pending", tdsRate: 10 });

  it("lists each recorded instalment that withheld TDS, filed by the day it arrived", () => {
    const campaigns = ledgerCampaigns(
      [deal],
      [],
      [
        makePaymentRecord({ id: "p1", target: { kind: "deal", campaignId: "D1" }, date: "2026-11-05", gross: 20000, tds: 2000, bankFee: 118 }),
        makePaymentRecord({ id: "p2", target: { kind: "deal", campaignId: "D1" }, date: "2027-04-10", gross: 30000, tds: 3000 }),
      ]
    );

    expect(summarizeTds(campaigns, 2026).payments).toEqual([
      expect.objectContaining({ paymentId: "p1", paidDate: "2026-11-05", gross: 20000, tdsAmount: 2000, estimated: false }),
    ]);
    expect(summarizeTds(campaigns, 2027).totalTds).toBe(3000);
    expect(tdsFinancialYears(campaigns, new Date("2026-10-27T06:00:00.000Z"))).toEqual([2027, 2026]);
  });

  it("leaves out a recorded payment that withheld nothing", () => {
    const campaigns = ledgerCampaigns(
      [deal],
      [],
      [makePaymentRecord({ id: "p1", target: { kind: "deal", campaignId: "D1" }, date: "2026-11-05", gross: 50000, tds: 0 })]
    );

    expect(summarizeTds(campaigns, 2026).payments).toEqual([]);
  });

  it("leaves out an invoice advance, which has no date", () => {
    const campaigns = ledgerCampaigns(
      [{ ...deal, invoiceId: "inv", invoiceRef: "MSP-INV-0009" }],
      [makeInvoiceRecord({ id: "inv", invoiceNo: "0009", status: "sent", issueDate: "2026-09-01", advance: 20000 })]
    );

    expect(summarizeTds(campaigns, 2026).payments).toEqual([]);
  });
});
