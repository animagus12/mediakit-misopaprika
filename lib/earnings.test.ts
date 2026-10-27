import { describe, expect, it } from "vitest";
import { makeMonthlyEarnings } from "@/lib/testing/fixtures";
import { cashReceived, computeMarginSeries, sumMonthlyEarnings } from "./earnings";

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

  it("keeps a month that paid for editing but received nothing", () => {
    const series = computeMarginSeries(
      [makeMonthlyEarnings("2026-05", { paid: 5000 })],
      new Map([
        ["2026-05", 1000],
        ["2026-04", 800],
      ])
    );

    expect(series).toEqual([
      { month: "2026-05", cash: 5000, editorCost: 1000, margin: 4000, marginPercent: 80 },
      { month: "2026-04", cash: 0, editorCost: 800, margin: -800, marginPercent: null },
    ]);
  });

  it("orders the union of both inputs newest first", () => {
    const series = computeMarginSeries(
      [makeMonthlyEarnings("2026-06", { paid: 1 }), makeMonthlyEarnings("2026-03", { paid: 2 })],
      new Map([
        ["2026-04", 300],
        ["2026-07", 100],
      ])
    );

    expect(series.map((m) => m.month)).toEqual(["2026-07", "2026-06", "2026-04", "2026-03"]);
  });

  it("rounds away floating point drift in cash and margin", () => {
    const series = computeMarginSeries(
      [makeMonthlyEarnings("2026-05", { paid: 0.1, commission: 0.2 })],
      new Map([["2026-05", 0.1]])
    );

    expect(series[0]).toMatchObject({ cash: 0.3, editorCost: 0.1, margin: 0.2 });
  });
});

describe("cashReceived", () => {
  it("is deal cash plus commission and never barter or pending", () => {
    expect(
      cashReceived(
        makeMonthlyEarnings("2026-05", { paid: 4000, commission: 1500, barter: 6000, pending: 9000, total: 11500 })
      )
    ).toBe(5500);
  });
});

describe("sumMonthlyEarnings", () => {
  it("adds each figure across the months on its own", () => {
    const totals = sumMonthlyEarnings([
      makeMonthlyEarnings("2026-05", {
        paid: 4000,
        tds: 400,
        fees: 18,
        net: 3582,
        barter: 1000,
        commission: 500,
        pending: 2000,
        total: 5500,
      }),
      makeMonthlyEarnings("2026-04", { paid: 0.1, net: 0.1, commission: 0.2, total: 0.3 }),
    ]);

    expect(totals).toEqual({
      total: 5500.3,
      paid: 4000.1,
      tds: 400,
      fees: 18,
      net: 3582.1,
      barter: 1000,
      commission: 500.2,
      pending: 2000,
    });
    expect(cashReceived(totals)).toBe(4500.3);
  });

  it("is all zeroes for no months", () => {
    expect(sumMonthlyEarnings([])).toEqual({
      total: 0,
      paid: 0,
      tds: 0,
      fees: 0,
      net: 0,
      barter: 0,
      commission: 0,
      pending: 0,
    });
  });
});
