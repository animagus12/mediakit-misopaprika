import { afterEach, describe, expect, it, vi } from "vitest";
import { makeEditorJob, makeInvoice } from "@/lib/testing/fixtures";
import {
  computeBalanceDue,
  computeInvoiceMargin,
  computeInvoiceMarginTotals,
  computeInvoiceStats,
  computeSubtotal,
  isInvoiceOverdue,
  paymentStatusForInvoice,
} from "./invoice";

afterEach(() => {
  vi.useRealTimers();
});

// isInvoiceOverdue reads the due date as 23:59:59 in the machine's local zone.
// The two instants below sit clear of that moment in every zone from UTC-12
// to UTC+14, so these pass whatever zone the test runner is in.
const BEFORE_DUE = new Date("2026-05-15T00:00:00.000Z");
const AFTER_DUE = new Date("2026-05-16T13:00:00.000Z");

describe("computeSubtotal", () => {
  it("sums quantity times price across the lines", () => {
    expect(
      computeSubtotal([
        { desc: "Reel", sub: "", qty: 2, price: 5000 },
        { desc: "Story", sub: "", qty: 3, price: 1000 },
      ])
    ).toBe(13000);
  });

  it("treats a missing or non-numeric quantity or price as zero", () => {
    expect(
      computeSubtotal([
        { desc: "Reel", sub: "", qty: Number.NaN, price: 5000 },
        { desc: "Story", sub: "", qty: 1, price: Number.NaN },
        { desc: "Usage", sub: "", qty: 1, price: 2500 },
      ])
    ).toBe(2500);
    expect(computeSubtotal([])).toBe(0);
  });
});

describe("computeBalanceDue", () => {
  it("subtracts the advance from the subtotal", () => {
    expect(computeBalanceDue(10000, 4000)).toBe(6000);
  });

  it("never goes below zero", () => {
    expect(computeBalanceDue(10000, 12000)).toBe(0);
  });

  it("treats a non-numeric advance as none", () => {
    expect(computeBalanceDue(10000, Number.NaN)).toBe(10000);
  });
});

describe("isInvoiceOverdue", () => {
  it("is overdue once a sent or draft invoice passes its due date", () => {
    expect(isInvoiceOverdue({ status: "sent", dueDate: "2026-05-15" }, AFTER_DUE)).toBe(true);
    expect(isInvoiceOverdue({ status: "draft", dueDate: "2026-05-15" }, AFTER_DUE)).toBe(true);
  });

  it("is not overdue on or before the due date", () => {
    expect(isInvoiceOverdue({ status: "sent", dueDate: "2026-05-15" }, BEFORE_DUE)).toBe(false);
  });

  it("is never overdue when paid, void or without a due date", () => {
    expect(isInvoiceOverdue({ status: "paid", dueDate: "2026-05-15" }, AFTER_DUE)).toBe(false);
    expect(isInvoiceOverdue({ status: "void", dueDate: "2026-05-15" }, AFTER_DUE)).toBe(false);
    expect(isInvoiceOverdue({ status: "sent", dueDate: "" }, AFTER_DUE)).toBe(false);
  });

  it("reads the current time when no instant is given", () => {
    vi.useFakeTimers();
    vi.setSystemTime(AFTER_DUE);
    expect(isInvoiceOverdue({ status: "sent", dueDate: "2026-05-15" })).toBe(true);
  });
});

describe("computeInvoiceStats", () => {
  it("bills sent and paid invoices, owes only the balance of unpaid ones and skips void", () => {
    const stats = computeInvoiceStats(
      [
        makeInvoice({ id: "sent", status: "sent", items: [{ desc: "", sub: "", qty: 1, price: 10000 }], advance: 2500 }),
        makeInvoice({ id: "paid", status: "paid", items: [{ desc: "", sub: "", qty: 1, price: 8000 }] }),
        makeInvoice({ id: "void", status: "void", items: [{ desc: "", sub: "", qty: 1, price: 50000 }] }),
      ],
      BEFORE_DUE
    );

    expect(stats).toEqual({ count: 2, totalBilled: 18000, totalOutstanding: 7500, overdueCount: 0 });
  });

  it("counts a draft in the pipeline but not as billed or owed", () => {
    const stats = computeInvoiceStats(
      [makeInvoice({ status: "draft", items: [{ desc: "", sub: "", qty: 1, price: 9000 }] })],
      BEFORE_DUE
    );

    expect(stats).toEqual({ count: 1, totalBilled: 0, totalOutstanding: 0, overdueCount: 0 });
  });

  it("counts overdue drafts and sent invoices, not paid or void ones", () => {
    const stats = computeInvoiceStats(
      [
        makeInvoice({ id: "1", status: "sent", dueDate: "2026-05-15" }),
        makeInvoice({ id: "2", status: "draft", dueDate: "2026-05-15" }),
        makeInvoice({ id: "3", status: "paid", dueDate: "2026-05-15" }),
        makeInvoice({ id: "4", status: "void", dueDate: "2026-05-15" }),
        makeInvoice({ id: "5", status: "sent", dueDate: "2026-06-30" }),
      ],
      AFTER_DUE
    );

    expect(stats.overdueCount).toBe(2);
  });

  it("does not count invoice barter value as billed", () => {
    const stats = computeInvoiceStats(
      [makeInvoice({ status: "sent", barter: { enabled: true, value: 4000, status: "" } })],
      BEFORE_DUE
    );

    expect(stats.totalBilled).toBe(10000);
    expect(stats.totalOutstanding).toBe(10000);
  });
});

describe("paymentStatusForInvoice", () => {
  const live = { status: "Posted" as const, paymentStatus: "pending" as const };

  it("marks the deal received when its invoice is paid", () => {
    expect(paymentStatusForInvoice(live, "paid")).toBe("received");
    expect(paymentStatusForInvoice({ ...live, paymentStatus: "unknown" }, "paid")).toBe("received");
  });

  it("marks the deal pending when its invoice is sent", () => {
    expect(paymentStatusForInvoice({ ...live, paymentStatus: "received" }, "sent")).toBe("pending");
    expect(paymentStatusForInvoice({ ...live, paymentStatus: "unknown" }, "sent")).toBe("pending");
  });

  it("returns null when the deal already says so", () => {
    expect(paymentStatusForInvoice({ ...live, paymentStatus: "received" }, "paid")).toBeNull();
    expect(paymentStatusForInvoice(live, "sent")).toBeNull();
  });

  it("says nothing for drafts, void invoices or called-off deals", () => {
    expect(paymentStatusForInvoice(live, "draft")).toBeNull();
    expect(paymentStatusForInvoice(live, "void")).toBeNull();
    expect(paymentStatusForInvoice({ ...live, status: "Cancelled" }, "paid")).toBeNull();
    expect(paymentStatusForInvoice({ ...live, status: "Redacted" }, "sent")).toBeNull();
  });
});

describe("computeInvoiceMargin", () => {
  it("nets the linked job's cost off the subtotal", () => {
    const invoice = makeInvoice({ editorTransactionId: "ET0001" });
    expect(computeInvoiceMargin(invoice, [makeEditorJob({ id: "ET0001", amount: 1500 })])).toEqual({
      editorCost: 1500,
      margin: 8500,
    });
  });

  it("returns null with no link or a link to a missing job", () => {
    const jobs = [makeEditorJob({ id: "ET0001" })];
    expect(computeInvoiceMargin(makeInvoice({ editorTransactionId: null }), jobs)).toBeNull();
    expect(computeInvoiceMargin(makeInvoice({ editorTransactionId: "ET9999" }), jobs)).toBeNull();
  });

  it("treats a job with no amount as costing nothing", () => {
    const invoice = makeInvoice({ editorTransactionId: "ET0001" });
    expect(computeInvoiceMargin(invoice, [makeEditorJob({ id: "ET0001", amount: null })])).toEqual({
      editorCost: 0,
      margin: 10000,
    });
  });
});

describe("computeInvoiceMarginTotals", () => {
  it("totals only issued invoices with a linked job", () => {
    const jobs = [makeEditorJob({ id: "ET0001", amount: 1000 }), makeEditorJob({ id: "ET0002", amount: 600 })];
    const totals = computeInvoiceMarginTotals(
      [
        makeInvoice({ id: "1", status: "sent", editorTransactionId: "ET0001" }),
        makeInvoice({
          id: "2",
          status: "paid",
          editorTransactionId: "ET0002",
          items: [{ desc: "", sub: "", qty: 1, price: 4000 }],
        }),
        makeInvoice({ id: "3", status: "sent", editorTransactionId: null }),
        makeInvoice({ id: "4", status: "draft", editorTransactionId: "ET0001" }),
        makeInvoice({ id: "5", status: "void", editorTransactionId: "ET0001" }),
      ],
      jobs
    );

    expect(totals).toEqual({ invoices: 2, billed: 14000, editorCost: 1600, margin: 12400 });
  });

  // KNOWN BUG, fixed in step 3: one editor job linked to two invoices (a deal
  // and its renewal, say) has its cost subtracted once per invoice, so the
  // 1,000 the edit cost is counted as 2,000.
  it("counts one editor job's cost once per invoice it is linked to", () => {
    const totals = computeInvoiceMarginTotals(
      [
        makeInvoice({ id: "1", status: "sent", editorTransactionId: "ET0001" }),
        makeInvoice({ id: "2", status: "paid", editorTransactionId: "ET0001" }),
      ],
      [makeEditorJob({ id: "ET0001", amount: 1000 })]
    );

    expect(totals).toEqual({ invoices: 2, billed: 20000, editorCost: 2000, margin: 18000 });
  });
});
