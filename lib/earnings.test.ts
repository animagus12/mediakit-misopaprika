import { describe, expect, it } from "vitest";
import { makeMonthlyEarnings } from "@/lib/testing/fixtures";
import { computeMarginSeries } from "./earnings";

describe("computeMarginSeries", () => {
  it("nets each month's cash and commission against its editing cost", () => {
    const series = computeMarginSeries(
      [makeMonthlyEarnings("2026-05", { paid: 10000, commission: 2000, total: 12000 })],
      new Map([["2026-05", 3000]])
    );

    expect(series).toEqual([
      { month: "2026-05", cash: 12000, editorCost: 3000, margin: 9000, marginPercent: 75 },
    ]);
  });

  it("leaves barter and pending money out of the cash a cost is netted from", () => {
    const series = computeMarginSeries(
      [makeMonthlyEarnings("2026-05", { paid: 4000, barter: 6000, pending: 9000, total: 10000 })],
      new Map([["2026-05", 1000]])
    );

    expect(series[0]).toMatchObject({ cash: 4000, margin: 3000, marginPercent: 75 });
  });

  it("nets a month with no editing to its cash", () => {
    const series = computeMarginSeries([makeMonthlyEarnings("2026-05", { paid: 5000 })], new Map());

    expect(series[0]).toEqual({ month: "2026-05", cash: 5000, editorCost: 0, margin: 5000, marginPercent: 100 });
  });

  it("reports a negative margin when editing cost more than came in", () => {
    const series = computeMarginSeries(
      [makeMonthlyEarnings("2026-05", { paid: 1000 })],
      new Map([["2026-05", 1500]])
    );

    expect(series[0]).toMatchObject({ margin: -500, marginPercent: -50 });
  });

  it("has no percentage for a month with no cash", () => {
    const series = computeMarginSeries(
      [makeMonthlyEarnings("2026-05", { barter: 3000, total: 3000 })],
      new Map([["2026-05", 400]])
    );

    expect(series[0]).toEqual({ month: "2026-05", cash: 0, editorCost: 400, margin: -400, marginPercent: null });
  });

  it("keeps the order of the monthly list it is given", () => {
    const series = computeMarginSeries(
      [makeMonthlyEarnings("2026-06", { paid: 1 }), makeMonthlyEarnings("2026-04", { paid: 2 })],
      new Map()
    );

    expect(series.map((m) => m.month)).toEqual(["2026-06", "2026-04"]);
  });

  // KNOWN BUG, fixed in step 3: the series is built only from months that had
  // income, so editing paid for in a month with none (here April) vanishes
  // from the chart instead of showing as a loss.
  it("drops editing cost in a month with no income", () => {
    const series = computeMarginSeries(
      [makeMonthlyEarnings("2026-05", { paid: 5000 })],
      new Map([
        ["2026-05", 1000],
        ["2026-04", 800],
      ])
    );

    expect(series).toEqual([
      { month: "2026-05", cash: 5000, editorCost: 1000, margin: 4000, marginPercent: 80 },
    ]);
  });
});
