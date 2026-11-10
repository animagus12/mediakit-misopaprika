/**
 * Shared by every A4 document the app saves as a PDF: invoices and the media
 * kit.
 *
 * A PDF is drawn by headless Chromium on the server rather than by the
 * device's print dialog: phones choose their own paper size and margins when
 * printing (iOS always adds margins, Android often defaults to Letter), so
 * the same sheet saved from a phone came out bordered. The editor POSTs the
 * document to its PDF route; the server opens the document's print page,
 * hands it the document under PRINT_PAYLOAD_GLOBAL before any script runs,
 * and prints once the page marks itself with PRINT_READY_ATTRIBUTE
 * (services/printPdf.server.ts, hooks/use-print-payload.ts).
 */
export const PRINT_PAYLOAD_GLOBAL = "__printPayload";
export const PRINT_READY_ATTRIBUTE = "data-print-ready";

/**
 * "MSP-INV-0014.pdf": `name` with anything that isn't safe in a filename or a
 * quoted header turned into a dash, and none left at either end.
 */
export function pdfFilename(name: string): string {
  const safe = name.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return `${safe || "document"}.pdf`;
}

/** Asks a PDF route for the document, as a file named `filename`. */
export async function fetchPdf(endpoint: string, payload: unknown, filename: string): Promise<File> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`${endpoint} answered ${response.status}`);

  return new File([await response.blob()], filename, { type: "application/pdf" });
}

/** Saves `file` to the device's downloads. */
export function savePdf(file: File): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  // Generous, as iOS Safari reads the file only once the download is
  // confirmed.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
