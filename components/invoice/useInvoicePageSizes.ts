"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { paginateInvoiceRows, type InvoicePageMetrics } from "@/lib/invoicePagination";

/** The blocks InvoicePreview's measuring sheet marks for measuring. */
type MeasuredBlock = "firstHead" | "continuedHead" | "items" | "totals" | "footer" | "continuedFooter";

/** Marks a block of the measuring sheet: `<div {...measured("totals")}>`. */
export function measured(block: MeasuredBlock) {
  return { "data-measure": block };
}

function blockHeight(sheet: HTMLElement, block: MeasuredBlock): number {
  return sheet.querySelector(`[data-measure="${block}"]`)?.getBoundingClientRect().height ?? 0;
}

function readPageMetrics(sheet: HTMLElement): InvoicePageMetrics | null {
  // Every height is read from the same zoomed preview, so they compare with
  // each other whatever size the preview is drawn at.
  const pageHeight = sheet.getBoundingClientRect().height;
  // Not laid out, as when printing hides the measuring sheet.
  if (pageHeight === 0) return null;

  const rows = Array.from(
    sheet.querySelectorAll('[data-measure="items"] tbody tr'),
    (row) => row.getBoundingClientRect().height
  );
  const rowsHeight = rows.reduce((total, height) => total + height, 0);

  return {
    pageHeight,
    firstHead: blockHeight(sheet, "firstHead"),
    continuedHead: blockHeight(sheet, "continuedHead"),
    tableFrame: blockHeight(sheet, "items") - rowsHeight,
    rows,
    lastTail: blockHeight(sheet, "totals") + blockHeight(sheet, "footer"),
    continuedTail: blockHeight(sheet, "continuedFooter"),
  };
}

function sameSizes(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((size, index) => size === b[index]);
}

/**
 * How many line items each preview page holds, worked out from a hidden sheet
 * that lays out every block a page can contain (attach `measureRef` to it).
 * Starts as one page, which is what the server renders.
 */
export function useInvoicePageSizes(itemCount: number) {
  const measureRef = useRef<HTMLDivElement>(null);
  const [pageSizes, setPageSizes] = useState<number[]>(() => [itemCount]);

  const measure = useCallback(() => {
    const sheet = measureRef.current;
    if (!sheet) return;
    const metrics = readPageMetrics(sheet);
    if (!metrics) return;
    const next = paginateInvoiceRows(metrics);
    setPageSizes((prev) => (sameSizes(prev, next) ? prev : next));
  }, []);

  // Any edit can change a block's height, and measuring before paint means a
  // new page break never flashes in.
  useLayoutEffect(measure);

  // Heights also change without a render, when the invoice fonts load.
  useEffect(() => {
    const sheet = measureRef.current;
    if (!sheet) return;
    const observer = new ResizeObserver(measure);
    for (const block of sheet.children) observer.observe(block);
    return () => observer.disconnect();
  }, [measure]);

  return { measureRef, pageSizes };
}
