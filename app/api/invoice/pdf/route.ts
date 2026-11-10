import { INVOICE_PRINT_PATH, invoicePdfFilename, isInvoicePrintPayload } from "@/lib/invoicePrint";
import { createPrintPdfRoute } from "@/lib/printPdfRoute.server";

// A cold start unpacks and launches Chromium before rendering.
export const maxDuration = 60;

/**
 * POST an InvoicePrintPayload: the invoice as it stands in the editor, saved
 * or not, comes back as an A4 PDF download.
 */
export const POST = createPrintPdfRoute({
  path: INVOICE_PRINT_PATH,
  isPayload: isInvoicePrintPayload,
  filename: (payload) => invoicePdfFilename(payload.state.invoiceNo),
  invalidPayloadError: "That isn't an invoice the PDF can be made from.",
  logLabel: "Invoice",
});
