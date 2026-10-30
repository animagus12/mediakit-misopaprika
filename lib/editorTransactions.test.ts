import { describe, expect, it } from "vitest";
import { makeEditorTransaction } from "@/lib/testing/fixtures";
import { describeChanges } from "@/lib/activityDiff";
import { editorTransactionFields } from "@/lib/activityFields";
import type { EditorTransactionRecord, NewEditorTransaction } from "@/repositories/editorTransactions";
import {
  computeEditorCashOutflowByMonth,
  computeEditorPayouts,
  computeMonthlyEditorCost,
  paidDateAfterStatusChange,
  validateEditorTransactionInput,
} from "./editorTransactions";

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

describe("toEditorTransaction payment details", () => {
  it("leaves a record from before payment details with none", () => {
    const txn = makeEditorTransaction({ status: "Paid" });
    expect(txn.paidDate).toBe("");
    expect(txn.paidBy).toBeUndefined();
    expect(txn.paymentMethod).toBeUndefined();
  });

  it("keeps known payers and methods and drops anything else", () => {
    const known = makeEditorTransaction({ paidDate: "03/10/2026", paidBy: "ritika", paymentMethod: "upi" });
    expect(known).toMatchObject({ paidDate: "03/10/2026", paidBy: "ritika", paymentMethod: "UPI" });

    const unknown = makeEditorTransaction({
      paidBy: "someone" as EditorTransactionRecord["paidBy"],
      paymentMethod: "Cheque",
    });
    expect(unknown.paidBy).toBeUndefined();
    expect(unknown.paymentMethod).toBeUndefined();
  });
});

describe("paidDateAfterStatusChange", () => {
  const today = "27/10/2026";

  it("stamps today when work becomes Paid without a date", () => {
    expect(paidDateAfterStatusChange({ status: "Pending" }, "Paid", today)).toBe(today);
    expect(paidDateAfterStatusChange({ status: "Pending", paidDate: "" }, "Paid", today)).toBe(today);
  });

  it("keeps a date already recorded", () => {
    expect(paidDateAfterStatusChange({ status: "Pending", paidDate: "01/10/2026" }, "Paid", today)).toBe(
      "01/10/2026"
    );
  });

  it("clears the date when work leaves Paid", () => {
    expect(paidDateAfterStatusChange({ status: "Paid", paidDate: "01/10/2026" }, "Pending", today)).toBe("");
    expect(paidDateAfterStatusChange({ status: "Paid", paidDate: "01/10/2026" }, "Cancelled", today)).toBe("");
  });

  it("never stamps old paid work that is picked as Paid again", () => {
    expect(paidDateAfterStatusChange({ status: " paid " }, "Paid", today)).toBe("");
  });

  it("puts back the exact date on undo, empty included", () => {
    expect(paidDateAfterStatusChange({ status: "Pending" }, "Paid", today, "01/10/2026")).toBe("01/10/2026");
    expect(paidDateAfterStatusChange({ status: "Pending" }, "Paid", today, "")).toBe("");
    expect(
      paidDateAfterStatusChange({ status: "Paid", paidDate: "01/10/2026" }, "Pending", today, "05/10/2026")
    ).toBe("");
  });
});

describe("validateEditorTransactionInput", () => {
  function input(overrides: Partial<NewEditorTransaction> = {}): NewEditorTransaction {
    return {
      video: "Launch reel",
      videoDate: "2026-10-01",
      deliveryDate: "",
      amount: 400,
      editor: "Editor",
      status: "Pending",
      revisions: 0,
      revisionRate: null,
      paidDate: "",
      ...overrides,
    };
  }

  // Server actions take whatever a POST sends, whatever the types say.
  function untyped(overrides: Record<string, unknown>): NewEditorTransaction {
    return { ...input(), ...overrides } as NewEditorTransaction;
  }

  it("accepts a complete transaction, with or without payment details", () => {
    expect(validateEditorTransactionInput(input())).toBeNull();
    expect(validateEditorTransactionInput(input({ amount: null }))).toBeNull();
    expect(validateEditorTransactionInput(input({ amount: 0 }))).toBeNull();
    expect(
      validateEditorTransactionInput(
        input({
          status: "Paid",
          deliveryDate: "2026-10-05",
          paidDate: "2026-10-07",
          paidBy: "business",
          paymentMethod: "Bank transfer",
        })
      )
    ).toBeNull();
  });

  it("requires a status from the allowed options", () => {
    expect(validateEditorTransactionInput(input({ status: "Done" }))).toBe("Pick a status");
    expect(validateEditorTransactionInput(input({ status: "paid" }))).toBe("Pick a status");
  });

  it("requires a finite, non-negative amount or none", () => {
    for (const amount of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(validateEditorTransactionInput(input({ amount }))).toBe("Amount must be a non-negative number");
    }
    expect(validateEditorTransactionInput(untyped({ amount: "400" }))).toBe(
      "Amount must be a non-negative number"
    );
  });

  it("requires valid dates", () => {
    expect(validateEditorTransactionInput(input({ videoDate: "" }))).toBe("Enter a valid assigned date");
    expect(validateEditorTransactionInput(input({ videoDate: "01/10/2026" }))).toBe("Enter a valid assigned date");
    expect(validateEditorTransactionInput(input({ deliveryDate: "2026-02-31" }))).toBe(
      "Enter a valid delivery date"
    );
    expect(validateEditorTransactionInput(input({ paidDate: "yesterday" }))).toBe("Enter a valid paid date");
  });

  it("requires a known payer and payment method when given", () => {
    expect(validateEditorTransactionInput(untyped({ paidBy: "Ritika" }))).toBe("Pick who paid");
    expect(validateEditorTransactionInput(untyped({ paymentMethod: "Cheque" }))).toBe("Pick a payment method");
  });

  it("requires the video and editor", () => {
    expect(validateEditorTransactionInput(input({ video: "  " }))).toBe("Enter the video");
    expect(validateEditorTransactionInput(input({ editor: "" }))).toBe("Pick an editor");
  });
});

describe("computeEditorCashOutflowByMonth", () => {
  it("buckets paid work on the day it was paid", () => {
    const byMonth = computeEditorCashOutflowByMonth([
      makeEditorTransaction({ id: "1", deliveryDate: "28/09/2026", paidDate: "02/10/2026", amount: 400 }),
      makeEditorTransaction({ id: "2", deliveryDate: "05/10/2026", paidDate: "06/10/2026", amount: 600 }),
    ]);

    expect(Object.fromEntries(byMonth)).toEqual({
      "2026-10": { amount: 1000, estimatedAmount: 0, count: 2, estimatedCount: 0 },
    });
  });

  it("falls back to the delivery date, then the assigned date, and flags both as estimates", () => {
    const byMonth = computeEditorCashOutflowByMonth([
      makeEditorTransaction({ id: "1", videoDate: "25/08/2026", deliveryDate: "02/09/2026", amount: 400 }),
      makeEditorTransaction({ id: "2", videoDate: "20/09/2026", deliveryDate: "", amount: 300 }),
      makeEditorTransaction({ id: "3", deliveryDate: "01/09/2026", paidDate: "10/09/2026", amount: 500 }),
    ]);

    expect(Object.fromEntries(byMonth)).toEqual({
      "2026-09": { amount: 1200, estimatedAmount: 700, count: 3, estimatedCount: 2 },
    });
  });

  it("counts only paid work, and drops zero, missing and undated amounts", () => {
    const byMonth = computeEditorCashOutflowByMonth([
      makeEditorTransaction({ id: "1", paidDate: "02/10/2026", amount: 400, status: "Pending" }),
      makeEditorTransaction({ id: "2", paidDate: "02/10/2026", amount: 400, status: "Cancelled" }),
      makeEditorTransaction({ id: "3", paidDate: "02/10/2026", amount: 0 }),
      makeEditorTransaction({ id: "4", paidDate: "02/10/2026", amount: null }),
      makeEditorTransaction({ id: "5", videoDate: "", deliveryDate: "", paidDate: "", amount: 400 }),
      makeEditorTransaction({ id: "6", paidDate: "02/10/2026", amount: 250, status: " PAID " }),
    ]);

    expect(Object.fromEntries(byMonth)).toEqual({
      "2026-10": { amount: 250, estimatedAmount: 0, count: 1, estimatedCount: 0 },
    });
  });
});

describe("editorTransactionFields", () => {
  const legacy: EditorTransactionRecord = {
    id: "ET0001",
    video: "Launch reel",
    videoDate: "01/10/2026",
    deliveryDate: "05/10/2026",
    amount: 400,
    editor: "Editor",
    status: "Pending",
  };

  it("logs no change when a record from before payment details is saved without any", () => {
    const after: EditorTransactionRecord = { ...legacy, revisions: 0, revisionRate: null, paidDate: "" };
    expect(describeChanges({ before: legacy, after }, editorTransactionFields)).toBeUndefined();
  });

  it("names the payment details that changed", () => {
    const after: EditorTransactionRecord = {
      ...legacy,
      status: "Paid",
      paidDate: "07/10/2026",
      paidBy: "business",
      paymentMethod: "UPI",
    };
    expect(describeChanges({ before: legacy, after }, editorTransactionFields)).toBe(
      "status Pending to Paid, paid on added, paid by added, +1 more"
    );
    expect(describeChanges({ before: after, after: { ...after, paidBy: "ritika" } }, editorTransactionFields)).toBe(
      "paid by Business funds to Ritika"
    );
  });
});
