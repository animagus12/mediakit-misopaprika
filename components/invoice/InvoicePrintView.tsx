"use client";

import { usePrintPayload } from "@/hooks/use-print-payload";
import { buildInvoiceNumber } from "@/lib/invoice";
import { isInvoicePrintPayload, type InvoicePrintPayload } from "@/lib/invoicePrint";
import { PRINT_READY_ATTRIBUTE } from "@/lib/printPdf";
import { InvoicePreview } from "./InvoicePreview";

function pdfTitle(payload: InvoicePrintPayload) {
  return buildInvoiceNumber(payload.state.invoiceNo);
}

/** The invoice sheets alone, as the PDF service prints them. */
export function InvoicePrintView() {
  const { payload, ready } = usePrintPayload(isInvoicePrintPayload, pdfTitle);

  if (!payload) return null;

  return (
    <div {...(ready ? { [PRINT_READY_ATTRIBUTE]: "" } : {})}>
      <InvoicePreview state={payload.state} amountReceived={payload.amountReceived} />
    </div>
  );
}
