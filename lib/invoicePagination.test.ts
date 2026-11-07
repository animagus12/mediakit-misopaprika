import { describe, expect, it } from "vitest";
import { paginateInvoiceRows, splitIntoPages, type InvoicePageMetrics } from "./invoicePagination";

// A page of 100 with a 30-high first head, a 10-high continued head, a table
// frame of 5, totals of 20 and a continued line of 5.
function metrics(rows: number[]): InvoicePageMetrics {
  return {
    pageHeight: 100,
    firstHead: 30,
    continuedHead: 10,
    tableFrame: 5,
    rows,
    lastTail: 20,
    continuedTail: 5,
  };
}

describe("paginateInvoiceRows", () => {
  it("keeps everything on one page when the rows and totals fit", () => {
    expect(paginateInvoiceRows(metrics([15, 15, 15]))).toEqual([3]);
  });

  it("fits a page exactly to the last unit", () => {
    expect(paginateInvoiceRows(metrics([45]))).toEqual([1]);
  });

  it("gives an invoice with no items a single page", () => {
    expect(paginateInvoiceRows(metrics([]))).toEqual([0]);
  });

  it("moves the rows that don't fit to a page that opens with the shorter head", () => {
    // Page one: 30 + 5 + 5 leaves 60, three rows of 20. Page two: 10 + 5 + 20
    // leaves 65 for the last two.
    expect(paginateInvoiceRows(metrics([20, 20, 20, 20, 20]))).toEqual([3, 2]);
  });

  it("fills as many pages as the rows need", () => {
    // Page one holds 2 rows of 25; later pages hold 3 (10 + 5 + 5 + 75).
    const sizes = paginateInvoiceRows(metrics(Array(10).fill(25)));
    expect(sizes).toEqual([2, 3, 3, 2]);
  });

  it("carries the last row over when the rows fit but the totals don't", () => {
    // Both rows fit above the continued line (30 + 5 + 5 + 60 = 100) but not
    // above the totals, so the second goes with the totals.
    expect(paginateInvoiceRows(metrics([30, 30]))).toEqual([1, 1]);
  });

  it("leaves the totals on a page of their own when a lone row fits without them", () => {
    expect(paginateInvoiceRows(metrics([55]))).toEqual([1, 0]);
  });

  it("gives a row taller than a page a page of its own", () => {
    expect(paginateInvoiceRows(metrics([10, 500, 10]))).toEqual([1, 1, 1]);
  });

  it("accounts for every row", () => {
    const rows = [12, 40, 7, 33, 18, 25, 9, 61, 14, 22, 30, 5];
    const total = paginateInvoiceRows(metrics(rows)).reduce((sum, size) => sum + size, 0);
    expect(total).toBe(rows.length);
  });
});

describe("splitIntoPages", () => {
  it("cuts items into pages of the given sizes", () => {
    expect(splitIntoPages(["a", "b", "c", "d"], [1, 2, 1])).toEqual([["a"], ["b", "c"], ["d"]]);
  });

  it("puts items added since the sizes were measured on the last page", () => {
    expect(splitIntoPages(["a", "b", "c", "d"], [1, 1])).toEqual([["a"], ["b", "c", "d"]]);
  });

  it("leaves later pages empty when items were removed", () => {
    expect(splitIntoPages(["a", "b"], [2, 2])).toEqual([["a", "b"], []]);
  });
});
