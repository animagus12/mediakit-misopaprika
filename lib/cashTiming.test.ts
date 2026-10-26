import { describe, expect, it } from "vitest";
import { makeCampaign, makeRenewal, makeUsage } from "@/lib/testing/fixtures";
import { computeMonthForecast } from "./cashTiming";

// Mid-May in IST whatever zone the runner is in.
const NOW = new Date("2026-05-10T06:00:00.000Z");

describe("computeMonthForecast", () => {
  it("adds the cash due this month to what was received, leaving barter out", () => {
    const forecast = computeMonthForecast(
      [
        makeCampaign({
          id: "1",
          amount: 6000,
          barterValue: 4000,
          paymentStatus: "pending",
          paymentDue: "20/05/2026",
          usage: makeUsage({
            renewals: [makeRenewal({ amount: 2000, paymentStatus: "pending", paymentDue: "25/05/2026" })],
          }),
        }),
        // Due next month: not this month's money.
        makeCampaign({ id: "2", amount: 9000, paymentStatus: "pending", paymentDue: "02/06/2026" }),
      ],
      5000,
      NOW
    );

    expect(forecast).toEqual({ month: "2026-05", received: 5000, expected: 8000, forecast: 13000, sources: 2 });
  });

  it("does not count a barter-only deal as money due", () => {
    const forecast = computeMonthForecast(
      [makeCampaign({ amount: 0, barterValue: 7000, paymentStatus: "pending", paymentDue: "20/05/2026" })],
      0,
      NOW
    );

    expect(forecast).toMatchObject({ expected: 0, sources: 0, forecast: 0 });
  });
});
