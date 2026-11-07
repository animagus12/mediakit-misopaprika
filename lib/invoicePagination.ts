// Splits an invoice's line items across A4 pages from the measured heights of
// the blocks a page is built from. Pure so the rule can be tested without a
// browser: the preview measures the blocks and renders the pages this returns.

/** Heights of the blocks an invoice page is built from, all in one unit. */
export interface InvoicePageMetrics {
  /** Room on a page between its smallest top and bottom margins. */
  pageHeight: number;
  /** Title plus the Issued to and Pay to blocks that open page one. */
  firstHead: number;
  /** Title plus the "continued" line that opens every later page. */
  continuedHead: number;
  /** The items table without its rows: the column headings and closing rule. */
  tableFrame: number;
  /** Each line item's row, in order. */
  rows: number[];
  /** Totals, closing line, signature and GST note that end the last page. */
  lastTail: number;
  /** The "Continued on page N" line that ends every other page. */
  continuedTail: number;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/**
 * How many line items each page holds. A page fills with as many rows as fit
 * above its footer. The last page also has to fit the totals, so when the
 * remaining rows fit but the totals don't, the last row moves over with them
 * rather than leaving the totals alone on a page. A row taller than a whole
 * page still gets a page of its own.
 */
export function paginateInvoiceRows(metrics: InvoicePageMetrics): number[] {
  const { pageHeight, tableFrame, rows } = metrics;
  const sizes: number[] = [];
  let start = 0;

  for (;;) {
    const head = sizes.length === 0 ? metrics.firstHead : metrics.continuedHead;
    const remaining = rows.slice(start);
    if (remaining.length === 0 || head + tableFrame + sum(remaining) + metrics.lastTail <= pageHeight) {
      sizes.push(remaining.length);
      return sizes;
    }

    let used = head + tableFrame + metrics.continuedTail;
    let count = 0;
    while (count < remaining.length && used + remaining[count] <= pageHeight) {
      used += remaining[count];
      count += 1;
    }
    if (count === remaining.length && count > 1) count -= 1;
    count = Math.max(count, 1);

    sizes.push(count);
    start += count;
  }
}

/**
 * Cuts items into pages of the given sizes. The last page takes whatever is
 * left, so sizes measured before items were added or removed still cover
 * every item until they are measured again.
 */
export function splitIntoPages<T>(items: T[], sizes: number[]): T[][] {
  const pages: T[][] = [];
  let start = 0;
  sizes.forEach((size, index) => {
    const end = index === sizes.length - 1 ? items.length : start + size;
    pages.push(items.slice(start, end));
    start = end;
  });
  return pages;
}
