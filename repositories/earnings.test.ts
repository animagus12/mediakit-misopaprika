import { describe, expect, it, vi } from "vitest";
import { makeCampaign, makePayout, makeRenewal, makeUsage } from "@/lib/testing/fixtures";
import { summarizeEarnings } from "./earnings";

// summarizeEarnings is pure, but its module also holds the repository that
// reads the store. The writers are replaced before the module loads, so these
// tests never reach Redis; anything that tried to would fail loudly here.
vi.mock("./campaigns.writer.server", () => ({
  getCampaigns: () => {
    throw new Error("tests must not read the store");
  },
}));
vi.mock("./affiliatePartners.writer.server", () => ({
  getAffiliatePartners: () => {
    throw new Error("tests must not read the store");
  },
}));
vi.mock("./affiliatePayouts.writer.server", () => ({
  getAffiliatePayouts: () => {
    throw new Error("tests must not read the store");
  },
}));

describe("summarizeEarnings", () => {
  it("returns zeroes and no months for an empty book", () => {
    expect(summarizeEarnings([])).toEqual({
      total: 0,
      paid: 0,
      barter: 0,
      commission: 0,
      pending: 0,
      monthly: [],
    });
  });

  it("splits received from pending and keeps pending out of total", () => {
    const summary = summarizeEarnings([
      makeCampaign({ id: "A", amount: 10000, paymentStatus: "received", uploadDate: "12/05/2026" }),
      makeCampaign({ id: "B", amount: 4000, paymentStatus: "pending", uploadDate: "20/05/2026" }),
    ]);

    expect(summary.total).toBe(10000);
    expect(summary.paid).toBe(10000);
    expect(summary.pending).toBe(4000);
    expect(summary.monthly).toHaveLength(1);
    expect(summary.monthly[0]).toMatchObject({
      month: "2026-05",
      total: 10000,
      paid: 10000,
      pending: 4000,
    });
    expect(summary.monthly[0].deals).toEqual([
      { brand: "Acme", amount: 10000, deliverables: "1 Organic Reel" },
      { brand: "Acme", amount: 4000, deliverables: "1 Organic Reel" },
    ]);
  });

  it("counts barter value into total but not into paid", () => {
    const summary = summarizeEarnings([
      makeCampaign({ type: "Barter+Paid", amount: 5000, barterValue: 3000, uploadDate: "12/05/2026" }),
    ]);

    expect(summary.total).toBe(8000);
    expect(summary.paid).toBe(5000);
    expect(summary.barter).toBe(3000);
  });

  // KNOWN BUG, fixed in step 3: the dashboard's "Received" tile renders the
  // month bucket's `total` (components/dashboard/EarningsOverview.tsx), and
  // that figure includes barter value, so a parcel reads as money received.
  it("puts barter value into the month total the Received tile shows", () => {
    const summary = summarizeEarnings([
      makeCampaign({ type: "Barter", amount: 0, barterValue: 6000, uploadDate: "12/05/2026" }),
    ]);

    expect(summary.monthly[0]).toMatchObject({ month: "2026-05", total: 6000, paid: 0, barter: 6000 });
  });

  it("counts the ad usage fee as part of the deal's cash", () => {
    const summary = summarizeEarnings([
      makeCampaign({ amount: 10000, usage: makeUsage({ fee: 2000 }), uploadDate: "12/05/2026" }),
    ]);

    expect(summary.paid).toBe(12000);
    expect(summary.total).toBe(12000);
  });

  it("buckets a deal by upload date, falling back to the deal date", () => {
    const summary = summarizeEarnings([
      makeCampaign({ id: "A", date: "03/04/2026", uploadDate: "05/06/2026", amount: 100 }),
      makeCampaign({ id: "B", date: "03/04/2026", uploadDate: "", amount: 200 }),
    ]);

    expect(summary.monthly.map((m) => [m.month, m.total])).toEqual([
      ["2026-06", 100],
      ["2026-04", 200],
    ]);
  });

  it("counts a deal with no usable date in the totals but in no month", () => {
    const summary = summarizeEarnings([makeCampaign({ date: "soon", uploadDate: "", amount: 700 })]);

    expect(summary.total).toBe(700);
    expect(summary.monthly).toEqual([]);
  });

  it("sorts months newest first", () => {
    const summary = summarizeEarnings([
      makeCampaign({ id: "A", uploadDate: "01/01/2026" }),
      makeCampaign({ id: "B", uploadDate: "01/03/2026" }),
      makeCampaign({ id: "C", uploadDate: "01/12/2025" }),
    ]);

    expect(summary.monthly.map((m) => m.month)).toEqual(["2026-03", "2026-01", "2025-12"]);
  });

  it("excludes called-off deals and their renewals from every figure", () => {
    const renewals = [makeRenewal({ amount: 3000, paidDate: "10/06/2026" })];
    const summary = summarizeEarnings([
      makeCampaign({ id: "A", status: "Cancelled", uploadDate: "12/05/2026", usage: makeUsage({ renewals }) }),
      makeCampaign({ id: "B", status: "Redacted", paymentStatus: "pending", uploadDate: "12/05/2026" }),
    ]);

    expect(summary).toEqual({ total: 0, paid: 0, barter: 0, commission: 0, pending: 0, monthly: [] });
  });

  it("skips a deal whose payment status is unknown", () => {
    const summary = summarizeEarnings([
      makeCampaign({ paymentStatus: "unknown", uploadDate: "12/05/2026", amount: 9000 }),
    ]);

    expect(summary).toEqual({ total: 0, paid: 0, barter: 0, commission: 0, pending: 0, monthly: [] });
  });

  describe("usage renewals", () => {
    it("credits a received renewal as cash to the month it was paid in", () => {
      const renewals = [makeRenewal({ amount: 3000, startDate: "10/07/2026", paidDate: "05/08/2026" })];
      const summary = summarizeEarnings([
        makeCampaign({ amount: 10000, uploadDate: "10/04/2026", usage: makeUsage({ renewals }) }),
      ]);

      expect(summary.total).toBe(13000);
      expect(summary.paid).toBe(13000);
      const august = summary.monthly.find((m) => m.month === "2026-08");
      expect(august).toMatchObject({ total: 3000, paid: 3000, barter: 0 });
      expect(august?.deals).toEqual([{ brand: "Acme", amount: 3000, deliverables: "Usage renewal" }]);
    });

    it("falls back to the renewal's start month when it has no paid date", () => {
      const renewals = [makeRenewal({ amount: 3000, startDate: "10/07/2026", paidDate: "" })];
      const summary = summarizeEarnings([
        makeCampaign({ uploadDate: "10/04/2026", usage: makeUsage({ renewals }) }),
      ]);

      expect(summary.monthly.find((m) => m.month === "2026-07")).toMatchObject({ total: 3000, paid: 3000 });
    });

    it("counts a pending renewal as pending, even on a received deal", () => {
      const renewals = [makeRenewal({ amount: 2500, paymentStatus: "pending", startDate: "10/07/2026" })];
      const summary = summarizeEarnings([
        makeCampaign({ amount: 10000, uploadDate: "10/04/2026", usage: makeUsage({ renewals }) }),
      ]);

      expect(summary.total).toBe(10000);
      expect(summary.pending).toBe(2500);
      expect(summary.monthly.find((m) => m.month === "2026-07")).toMatchObject({ total: 0, pending: 2500 });
    });

    it("ignores free extensions and renewals of unknown status", () => {
      const renewals = [
        makeRenewal({ id: "R0001", amount: 0, startDate: "10/07/2026" }),
        makeRenewal({ id: "R0002", amount: 1500, paymentStatus: "unknown", startDate: "10/08/2026" }),
      ];
      const summary = summarizeEarnings([
        makeCampaign({ amount: 10000, uploadDate: "10/04/2026", usage: makeUsage({ renewals }) }),
      ]);

      expect(summary.total).toBe(10000);
      expect(summary.pending).toBe(0);
      expect(summary.monthly.map((m) => m.month)).toEqual(["2026-04"]);
    });

    it("counts renewals on a deal whose own payment status is unknown", () => {
      const renewals = [makeRenewal({ amount: 3000, paidDate: "05/08/2026" })];
      const summary = summarizeEarnings([
        makeCampaign({ paymentStatus: "unknown", uploadDate: "10/04/2026", usage: makeUsage({ renewals }) }),
      ]);

      expect(summary.total).toBe(3000);
      expect(summary.monthly.map((m) => m.month)).toEqual(["2026-08"]);
    });
  });

  describe("affiliate payouts", () => {
    it("counts received commission into total and commission, never paid or barter", () => {
      const summary = summarizeEarnings(
        [makeCampaign({ amount: 10000, uploadDate: "12/06/2026" })],
        [makePayout({ commissionAmount: 1200, paidDate: "15/06/2026", partner: "Shop" })]
      );

      expect(summary).toMatchObject({ total: 11200, paid: 10000, barter: 0, commission: 1200, pending: 0 });
      const june = summary.monthly.find((m) => m.month === "2026-06");
      expect(june).toMatchObject({ total: 11200, paid: 10000, commission: 1200 });
      expect(june?.deals).toContainEqual({ brand: "Shop", amount: 1200, deliverables: "Affiliate commission" });
    });

    it("falls back to the period end month when the payout has no paid date", () => {
      const summary = summarizeEarnings([], [makePayout({ paidDate: "", periodEnd: "30/04/2026" })]);

      expect(summary.monthly.map((m) => m.month)).toEqual(["2026-04"]);
    });

    it("counts a pending payout as pending only", () => {
      const summary = summarizeEarnings(
        [],
        [makePayout({ commissionAmount: 800, paymentStatus: "pending", periodEnd: "30/04/2026" })]
      );

      expect(summary).toMatchObject({ total: 0, commission: 0, pending: 800 });
      expect(summary.monthly[0]).toMatchObject({ month: "2026-04", total: 0, pending: 800 });
    });

    it("ignores a period that earned nothing", () => {
      const summary = summarizeEarnings([], [makePayout({ commissionAmount: 0 })]);

      expect(summary.monthly).toEqual([]);
      expect(summary.total).toBe(0);
    });
  });

  it("keeps paid, barter and commission disjoint so they sum to total", () => {
    const renewals = [makeRenewal({ amount: 2000, paidDate: "05/05/2026" })];
    const summary = summarizeEarnings(
      [
        makeCampaign({ id: "A", type: "Barter+Paid", amount: 5000, barterValue: 1500, uploadDate: "01/05/2026" }),
        makeCampaign({ id: "B", amount: 7000, uploadDate: "01/05/2026", usage: makeUsage({ renewals }) }),
      ],
      [makePayout({ commissionAmount: 900, paidDate: "20/05/2026" })]
    );

    expect(summary.paid + summary.barter + summary.commission).toBe(summary.total);
    expect(summary.total).toBe(5000 + 1500 + 7000 + 2000 + 900);
  });
});
