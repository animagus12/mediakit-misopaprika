import type { InvoiceFormState } from "@/components/invoice/types";
import { buildInvoiceNumber, type InvoiceLineItem } from "./invoice";
import { fetchPdf, pdfFilename } from "./printPdf";

/**
 * The contract between the invoice editor, the PDF route and the print page
 * (lib/printPdf.ts says why the server draws the PDF).
 */
export interface InvoicePrintPayload {
  state: InvoiceFormState;
  /** As the preview shows it: what the payment ledger has received. */
  amountReceived: number;
}

export const INVOICE_PRINT_PATH = "/invoices/print";

/** The invoice as the editor shows it, as a PDF file. */
export function fetchInvoicePdf(payload: InvoicePrintPayload): Promise<File> {
  return fetchPdf("/api/invoice/pdf", payload, invoicePdfFilename(payload.state.invoiceNo));
}

const STRING_FIELDS = [
  "status",
  "invoiceNo",
  "campaignName",
  "date",
  "due",
  "clientName",
  "clientContactName",
  "clientEmail",
  "clientAddress",
  "clientPanNumber",
  "clientGstNumber",
  "barterStatus",
  "payName",
  "payEmail",
  "paymentMode",
  "upi",
  "bankAccountName",
  "bankAccountNumber",
  "bankIfsc",
  "bankName",
  "gstNote",
  "closing",
  "panNumber",
  "address",
  "instagramHandle",
  "youtubeHandle",
] as const satisfies readonly (keyof InvoiceFormState)[];

const NULLABLE_STRING_FIELDS = [
  "brandId",
  "editorTransactionId",
  "qrImage",
  "stampImage",
] as const satisfies readonly (keyof InvoiceFormState)[];

const BOOLEAN_FIELDS = ["barterOn", "showInstagram", "showYouTube"] as const satisfies readonly (keyof InvoiceFormState)[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isLineItem(value: unknown): value is InvoiceLineItem {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.desc === "string" &&
    typeof value.sub === "string" &&
    isFiniteNumber(value.qty) &&
    isFiniteNumber(value.price)
  );
}

function isInvoiceFormState(value: unknown): value is InvoiceFormState {
  return (
    isRecord(value) &&
    STRING_FIELDS.every((field) => typeof value[field] === "string") &&
    NULLABLE_STRING_FIELDS.every((field) => value[field] === null || typeof value[field] === "string") &&
    BOOLEAN_FIELDS.every((field) => typeof value[field] === "boolean") &&
    isFiniteNumber(value.barterVal) &&
    Array.isArray(value.items) &&
    value.items.every(isLineItem)
  );
}

/**
 * Checked field by field because the payload arrives as JSON from the
 * client: a malformed one is refused up front instead of failing inside the
 * headless browser after a long wait.
 */
export function isInvoicePrintPayload(value: unknown): value is InvoicePrintPayload {
  return isRecord(value) && isFiniteNumber(value.amountReceived) && isInvoiceFormState(value.state);
}

/** "MSP-INV-0014.pdf": what the downloaded file is called. */
export function invoicePdfFilename(invoiceNo: string): string {
  return pdfFilename(buildInvoiceNumber(invoiceNo));
}
