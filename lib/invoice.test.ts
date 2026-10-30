import { afterEach, describe, expect, it, vi } from "vitest";
import { makeCampaign, makeEditorJob, makeEditorTransaction, makeInvoice } from "@/lib/testing/fixtures";
import {
  buildInvoiceDealOptions,
  buildInvoiceEditorJobOptions,
  computeBalanceDue,
  computeInvoiceMargin,
  computeInvoiceMarginTotals,
  computeInvoiceStats,
  computeSubtotal,
  editorJobTakenMessage,
  findEditorJobHolder,
  holdsEditorJob,
  invoiceFinancialYears,
  invoicesInFinancialYear,
  isInvoiceOverdue,
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

describe("invoicesInFinancialYear", () => {
  const invoices = [
    makeInvoice({ id: "march", issueDate: "2026-03-31" }),
    makeInvoice({ id: "april", issueDate: "2026-04-01" }),
    makeInvoice({ id: "next-march", issueDate: "2027-03-31" }),
    makeInvoice({ id: "undated", issueDate: "" }),
  ];

  it("keeps the invoices issued from 1 April to 31 March", () => {
    expect(invoicesInFinancialYear(invoices, 2026).map((invoice) => invoice.id)).toEqual([
      "april",
      "next-march",
    ]);
    expect(invoicesInFinancialYear(invoices, 2025).map((invoice) => invoice.id)).toEqual(["march"]);
  });

  it("keeps every invoice, undated ones included, for the All view", () => {
    expect(invoicesInFinancialYear(invoices, null)).toEqual(invoices);
  });

  it("feeds the stat cards only the year's invoices", () => {
    const stats = computeInvoiceStats(
      invoicesInFinancialYear(
        [
          makeInvoice({ id: "old", status: "paid", issueDate: "2026-03-10" }),
          makeInvoice({ id: "new", status: "sent", issueDate: "2026-04-10", advance: 1000 }),
        ],
        2026
      ),
      BEFORE_DUE
    );

    expect(stats).toEqual({ count: 1, totalBilled: 10000, totalOutstanding: 9000, overdueCount: 0 });
  });
});

describe("invoiceFinancialYears", () => {
  it("offers each issue year once plus the current one, newest first", () => {
    const years = invoiceFinancialYears(
      [
        makeInvoice({ issueDate: "2024-06-01" }),
        makeInvoice({ issueDate: "2025-01-15" }),
        makeInvoice({ issueDate: "" }),
      ],
      new Date("2026-10-27T06:00:00.000Z")
    );

    expect(years).toEqual([2026, 2024]);
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

  it("nets one editor job's cost once however many invoices link it", () => {
    const totals = computeInvoiceMarginTotals(
      [
        makeInvoice({ id: "1", status: "sent", editorTransactionId: "ET0001" }),
        makeInvoice({
          id: "2",
          status: "paid",
          editorTransactionId: "ET0001",
          items: [{ desc: "", sub: "", qty: 1, price: 3000 }],
        }),
      ],
      [makeEditorJob({ id: "ET0001", amount: 1000 })]
    );

    expect(totals).toEqual({ invoices: 2, billed: 13000, editorCost: 1000, margin: 12000 });
  });

  it("rounds away floating point drift in the totals", () => {
    const totals = computeInvoiceMarginTotals(
      [
        makeInvoice({ id: "1", editorTransactionId: "ET0001", items: [{ desc: "", sub: "", qty: 1, price: 0.1 }] }),
        makeInvoice({ id: "2", editorTransactionId: "ET0002", items: [{ desc: "", sub: "", qty: 1, price: 0.2 }] }),
      ],
      [makeEditorJob({ id: "ET0001", amount: 0 }), makeEditorJob({ id: "ET0002", amount: 0.1 })]
    );

    expect(totals).toEqual({ invoices: 2, billed: 0.3, editorCost: 0.1, margin: 0.2 });
  });
});

describe("holdsEditorJob", () => {
  it("is true for a linked invoice in any status but void", () => {
    expect(holdsEditorJob({ status: "draft", editorTransactionId: "ET0001" })).toBe(true);
    expect(holdsEditorJob({ status: "sent", editorTransactionId: "ET0001" })).toBe(true);
    expect(holdsEditorJob({ status: "paid", editorTransactionId: "ET0001" })).toBe(true);
    expect(holdsEditorJob({ status: "void", editorTransactionId: "ET0001" })).toBe(false);
    expect(holdsEditorJob({ status: "sent", editorTransactionId: null })).toBe(false);
  });
});

describe("findEditorJobHolder", () => {
  const invoices = [
    makeInvoice({ id: "1", invoiceNo: "0001", status: "sent", editorTransactionId: "ET0001" }),
    makeInvoice({ id: "2", invoiceNo: "0002", status: "void", editorTransactionId: "ET0002" }),
  ];

  it("finds the other invoice holding the job", () => {
    expect(findEditorJobHolder("ET0001", invoices)?.id).toBe("1");
  });

  it("never blocks the invoice being edited on its own link", () => {
    expect(findEditorJobHolder("ET0001", invoices, "1")).toBeNull();
  });

  it("treats a job linked only from a void invoice as free", () => {
    expect(findEditorJobHolder("ET0002", invoices)).toBeNull();
  });

  it("is null with no job to look for", () => {
    expect(findEditorJobHolder(null, invoices)).toBeNull();
  });

  it("names the holding invoice in the error a save shows", () => {
    expect(editorJobTakenMessage(invoices[0])).toContain("0001");
  });
});

describe("buildInvoiceEditorJobOptions", () => {
  const transactions = [
    makeEditorTransaction({ id: "ET0001", videoDate: "01/05/2026" }),
    makeEditorTransaction({ id: "ET0002", videoDate: "02/05/2026" }),
    makeEditorTransaction({ id: "ET0003", videoDate: "03/05/2026" }),
    makeEditorTransaction({ id: "ET0004", videoDate: "04/05/2026", status: "Cancelled" }),
  ];

  it("returns every job that is not cancelled, newest first, without claims", () => {
    expect(buildInvoiceEditorJobOptions(transactions).map((job) => job.id)).toEqual([
      "ET0003",
      "ET0002",
      "ET0001",
    ]);
  });

  it("hides jobs another invoice holds from a new invoice's picker", () => {
    const invoices = [
      makeInvoice({ id: "1", editorTransactionId: "ET0001" }),
      makeInvoice({ id: "2", status: "void", editorTransactionId: "ET0002" }),
    ];

    expect(buildInvoiceEditorJobOptions(transactions, { invoices }).map((job) => job.id)).toEqual([
      "ET0003",
      "ET0002",
    ]);
  });

  it("keeps the edited invoice's own link visible even when legacy data shares it", () => {
    const invoices = [
      makeInvoice({ id: "1", editorTransactionId: "ET0001" }),
      makeInvoice({ id: "2", editorTransactionId: "ET0001" }),
      makeInvoice({ id: "3", editorTransactionId: "ET0003" }),
    ];

    expect(
      buildInvoiceEditorJobOptions(transactions, { invoices, currentInvoiceId: "2" }).map((job) => job.id)
    ).toEqual(["ET0002", "ET0001"]);
  });
});

describe("buildInvoiceDealOptions", () => {
  it("offers cash deals with no invoice that aren't called off, the invoice's own brand first", () => {
    const campaigns = [
      makeCampaign({ id: "other", brand: "Zed", campaign: "Teaser", brandId: "b-zed" }),
      makeCampaign({ id: "own", brand: "Acme", campaign: "Launch", brandId: "b-acme" }),
      makeCampaign({ id: "linked", campaign: "Linked", invoiceId: "inv-9" }),
      makeCampaign({ id: "barter", campaign: "Hamper", type: "Barter", amount: 0, barterValue: 5000 }),
      makeCampaign({ id: "off", campaign: "Dropped", status: "Cancelled" }),
    ];

    expect(buildInvoiceDealOptions({ brandId: "b-acme" }, campaigns)).toEqual([
      { id: "own", label: "Launch" },
      { id: "other", label: "Teaser" },
    ]);
  });
});
