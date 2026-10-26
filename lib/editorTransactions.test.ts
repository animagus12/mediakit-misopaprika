import { describe, expect, it } from "vitest";
import { makeEditorTransaction } from "@/lib/testing/fixtures";
import { computeEditorPayouts, computeMonthlyEditorCost } from "./editorTransactions";

describe("computeEditorPayouts", () => {
  it("splits paid from pending and ignores cancelled work", () => {
    expect(
      computeEditorPayouts([
        makeEditorTransaction({ id: "1", amount: 400, status: "Paid" }),
        makeEditorTransaction({ id: "2", amount: 600, status: "Paid" }),
        makeEditorTransaction({ id: "3", amount: 500, status: "Pending" }),
        makeEditorTransaction({ id: "4", amount: 900, status: "Cancelled" }),
      ])
    ).toEqual({ paid: 1000, pending: 500 });
  });

  it("matches status without regard to case or surrounding spaces", () => {
    expect(
      computeEditorPayouts([
        makeEditorTransaction({ id: "1", amount: 400, status: " paid " }),
        makeEditorTransaction({ id: "2", amount: 300, status: "PENDING" }),
      ])
    ).toEqual({ paid: 400, pending: 300 });
  });

  it("treats a missing amount as nothing and skips unrecognised statuses", () => {
    expect(
      computeEditorPayouts([
        makeEditorTransaction({ id: "1", amount: null, status: "Paid" }),
        makeEditorTransaction({ id: "2", amount: 700, status: "On hold" }),
      ])
    ).toEqual({ paid: 0, pending: 0 });
  });
});

describe("computeMonthlyEditorCost", () => {
  it("buckets by delivery month, falling back to the assigned month", () => {
    const byMonth = computeMonthlyEditorCost([
      makeEditorTransaction({ id: "1", videoDate: "28/04/2026", deliveryDate: "02/05/2026", amount: 400 }),
      makeEditorTransaction({ id: "2", videoDate: "10/05/2026", deliveryDate: "", amount: 600 }),
      makeEditorTransaction({ id: "3", videoDate: "15/04/2026", deliveryDate: "20/04/2026", amount: 500 }),
    ]);

    expect(Object.fromEntries(byMonth)).toEqual({ "2026-05": 1000, "2026-04": 500 });
  });

  it("counts pending work with paid and leaves out cancelled work", () => {
    const byMonth = computeMonthlyEditorCost([
      makeEditorTransaction({ id: "1", videoDate: "10/05/2026", amount: 400, status: "Paid" }),
      makeEditorTransaction({ id: "2", videoDate: "11/05/2026", amount: 300, status: "Pending" }),
      makeEditorTransaction({ id: "3", videoDate: "12/05/2026", amount: 900, status: " cancelled " }),
    ]);

    expect(Object.fromEntries(byMonth)).toEqual({ "2026-05": 700 });
  });

  it("drops zero, missing and undated amounts", () => {
    const byMonth = computeMonthlyEditorCost([
      makeEditorTransaction({ id: "1", videoDate: "10/05/2026", amount: 0 }),
      makeEditorTransaction({ id: "2", videoDate: "10/05/2026", amount: null }),
      makeEditorTransaction({ id: "3", videoDate: "", deliveryDate: "", amount: 400 }),
      makeEditorTransaction({ id: "4", videoDate: "2026-05-10", deliveryDate: "", amount: 400 }),
    ]);

    expect(byMonth.size).toBe(0);
  });
});
