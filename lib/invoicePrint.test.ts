import { describe, expect, it } from "vitest";
import type { InvoiceFormState } from "@/components/invoice/types";
import { invoicePdfFilename, isInvoicePrintPayload, type InvoicePrintPayload } from "./invoicePrint";

function makeState(overrides: Partial<InvoiceFormState> = {}): InvoiceFormState {
  return {
    status: "draft",
    invoiceNo: "14",
    brandId: null,
    editorTransactionId: null,
    campaignName: "Diwali reel",
    date: "2026-11-10",
    due: "2026-11-25",
    clientName: "Acme",
    clientContactName: "",
    clientEmail: "",
    clientAddress: "",
    clientPanNumber: "",
    clientGstNumber: "",
    items: [{ id: "item-0", desc: "Instagram reel", sub: "", qty: 1, price: 9500 }],
    barterOn: false,
    barterVal: 0,
    barterStatus: "",
    payName: "Miso Paprika",
    payEmail: "hello@example.com",
    paymentMode: "upi",
    upi: "miso@upi",
    bankAccountName: "",
    bankAccountNumber: "",
    bankIfsc: "",
    bankName: "",
    gstNote: "",
    closing: "Thank you",
    qrImage: "https://example.public.blob.vercel-storage.com/qr.png",
    stampImage: null,
    panNumber: "",
    address: "",
    instagramHandle: "misopaprika",
    youtubeHandle: "",
    showInstagram: true,
    showYouTube: false,
    ...overrides,
  };
}

function makePayload(overrides: Partial<InvoicePrintPayload> = {}): InvoicePrintPayload {
  return { state: makeState(), amountReceived: 0, ...overrides };
}

describe("isInvoicePrintPayload", () => {
  it("accepts an invoice as the editor holds it", () => {
    expect(isInvoicePrintPayload(makePayload())).toBe(true);
  });

  it("survives a round trip through JSON", () => {
    expect(isInvoicePrintPayload(JSON.parse(JSON.stringify(makePayload({ amountReceived: 500 }))))).toBe(true);
  });

  it("refuses anything that isn't a payload", () => {
    expect(isInvoicePrintPayload(null)).toBe(false);
    expect(isInvoicePrintPayload("invoice")).toBe(false);
    expect(isInvoicePrintPayload({ state: makeState() })).toBe(false);
    expect(isInvoicePrintPayload({ amountReceived: 0 })).toBe(false);
  });

  it("refuses a state with a field of the wrong type", () => {
    expect(isInvoicePrintPayload({ ...makePayload(), state: { ...makeState(), clientName: 5 } })).toBe(false);
    expect(isInvoicePrintPayload({ ...makePayload(), state: { ...makeState(), showInstagram: "yes" } })).toBe(false);
    expect(isInvoicePrintPayload({ ...makePayload(), state: { ...makeState(), qrImage: undefined } })).toBe(false);
  });

  it("refuses a malformed line item", () => {
    const state = { ...makeState(), items: [{ id: "item-0", desc: "Reel", sub: "", qty: "1", price: 9500 }] };
    expect(isInvoicePrintPayload({ ...makePayload(), state })).toBe(false);
  });

  it("refuses an amount received that isn't a finite number", () => {
    expect(isInvoicePrintPayload({ ...makePayload(), amountReceived: "500" })).toBe(false);
    expect(isInvoicePrintPayload({ ...makePayload(), amountReceived: Number.NaN })).toBe(false);
  });
});

describe("invoicePdfFilename", () => {
  it("names the file after the invoice number", () => {
    expect(invoicePdfFilename("14")).toBe("MSP-INV-0014.pdf");
  });

  it("replaces characters that would break a filename or header", () => {
    expect(invoicePdfFilename('12/"A" b')).toBe("MSP-INV-12-A-b.pdf");
  });
});
