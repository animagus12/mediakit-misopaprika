import { formatInvoiceDate } from "@/lib/invoice";
import { formatUsageDays } from "@/lib/usageRights";
import type { InvoiceData } from "@/repositories/invoice";
import type { InvoicePaymentSnapshot, NewInvoice } from "@/repositories/invoices";

// Turns a licence renewal into the invoice that bills for it.
//
// A renewal is a sale: days of usage for a price, agreed on a date, owed by
// a date. Every one of those is already captured when the renewal is recorded,
// so retyping them into the invoice editor afterwards was pure transcription,
// and the invoice that never got retyped was the one the money went missing
// on. Raising it is now part of recording the renewal.
//
// Pure and dependency-free on purpose: it takes the defaults, the brand and
// the renewal and answers a NewInvoice, so the action that saves it stays a
// sequence of writes rather than a mapping layer.

export interface RenewalInvoiceInput {
  /** The payee/bank/branding block and billing terms, as the editor seeds them. */
  defaults: InvoiceData;
  /** Every saved invoice, so the number picked cannot collide with one. */
  existing: { invoiceNo: string }[];
  brandName: string;
  brandId: string | null;
  /** The brand's primary contact, or "" when it has none on file. */
  contactName: string;
  /** The deal's campaign name, or "" when it was never given one. */
  campaignName: string;
  days: number;
  amount: number;
  startDate: string; // yyyy-mm-dd, the day the extended term runs from
  /** yyyy-mm-dd the fee is due, or "" to fall back to the defaults' terms. */
  dueDate: string;
  /** Whether the money was already collected when the renewal was recorded. */
  paid: boolean;
  today: string; // yyyy-mm-dd
}

/**
 * The next invoice number: one past the highest number actually in use,
 * zero-padded to the width already in use.
 *
 * Read from the saved invoices, never from `invoiceNumberSeed`, once any
 * exist. The seed only ever moves forward, so an invoice raised as 0015 and
 * then renamed (or deleted) left it at 0016 and the sequence with a hole in
 * it. Counting what exists hands 0015 out again instead. Gaps lower down, such
 * as a number skipped by hand, are left alone: only the top is reclaimed.
 *
 * The seed is the starting number while there are no invoices at all.
 */
export function nextInvoiceNo(existing: { invoiceNo: string }[], seed: string): string {
  let highest = -1;
  for (const invoice of existing) {
    const trimmed = invoice.invoiceNo.trim();
    const value = Number(trimmed);
    if (trimmed && Number.isInteger(value) && value >= 0) highest = Math.max(highest, value);
  }
  const seedValue = Number(seed.trim());
  const next = highest >= 0 ? highest + 1 : Number.isInteger(seedValue) && seedValue > 0 ? seedValue : 1;
  return String(next).padStart(Math.max(4, seed.trim().length), "0");
}

export function termLine(days: number, startDate: string): string {
  const term = formatUsageDays(days);
  const from = formatInvoiceDate(startDate);
  return from ? `${term} from ${from}` : term;
}

/**
 * Adds `days` to a yyyy-mm-dd date.
 *
 * Calendar arithmetic in UTC on both ends. Parsing at local midnight and
 * formatting with toISOString, as this used to, lands on the previous day
 * anywhere east of UTC: in IST every due date came out one day short.
 */
export function addDaysISO(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * The invoice for one renewal, with every field the editor would have asked
 * for already answered.
 *
 * Two choices worth stating:
 *
 * It is saved as a **draft** unless the money is already in, never as "sent".
 * The app cannot know an invoice has actually been emailed, and marking one
 * sent would have the dashboard chasing a document still sitting unsent in the
 * app. The renewal fee is already chased by the usage card, so nothing is lost
 * by waiting for the creator to send it and say so.
 *
 * Its **campaign name is not the deal's**: "IG Page usage renewal", so the
 * document can't be mistaken for the deal's own invoice in the invoices list.
 * It is linked to the renewal, never to the deal (see invoiceOwner).
 */
export function buildRenewalInvoice(input: RenewalInvoiceInput): NewInvoice {
  const { defaults } = input;
  const campaign = input.campaignName.trim();

  return {
    status: input.paid ? "paid" : "draft",
    invoiceNo: nextInvoiceNo(input.existing, defaults.invoiceNumberSeed),
    brandId: input.brandId,
    editorTransactionId: null,
    campaignName: campaign ? `${campaign} usage renewal` : "Ad usage renewal",
    issueDate: input.today,
    // The date the fee was actually agreed for wins; the defaults' payment
    // terms only fill in when the renewal was recorded without one.
    dueDate: input.dueDate || addDaysISO(input.today, defaults.dueInDays),
    client: {
      name: input.brandName.trim(),
      contactName: input.contactName.trim(),
      // Contacts carry a name and a phone, never an email, and the defaults'
      // billed-to block is a placeholder: putting either on a real invoice
      // would be inventing an address. Left blank for the creator to fill.
      email: "",
    },
    items: [
      {
        desc: "Ad usage rights renewal",
        sub: termLine(input.days, input.startDate),
        qty: 1,
        price: input.amount,
      },
    ],
    advance: 0,
    // A licence extension is paid in cash or not at all: there is no product
    // being sent for it, which is what barter on a deal accounts for.
    barter: { enabled: false, value: 0, status: "" },
    payment: paymentSnapshot(defaults),
  };
}

/** The payee, bank and branding block a new invoice snapshots from the defaults. */
export function paymentSnapshot(defaults: InvoiceData): InvoicePaymentSnapshot {
  const { payee } = defaults;
  return {
    payeeName: payee.name,
    payeeEmail: payee.email,
    mode: payee.paymentMode,
    upi: payee.upi,
    bank: { ...payee.bank },
    footerNote: payee.footerNote,
    closingLine: payee.closingLine,
    qrImage: payee.defaultQrImage,
    stampImage: payee.defaultStampImage,
  };
}
