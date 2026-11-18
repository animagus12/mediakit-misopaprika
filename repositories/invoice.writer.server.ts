import "server-only";
import { getRedis, requireRedis, readStored } from "@/lib/cache";
import { mutateStored } from "@/lib/storeWrite.server";
import { invoiceRepository, type InvoiceData } from "./invoice";

// server-only, and never imported from a client component: the server
// actions and pages that need it import it directly. Reading/writing the
// invoice draft goes through Redis (Vercel's serverless filesystem is
// read-only), so that logic lives here rather than in ./invoice.
const INVOICE_DRAFT_KEY = "invoice_draft";

// Backfills fields added to InvoiceData after a draft was last saved (e.g.
// payee.paymentMode/bank) with the bundled JSON's defaults, so old Redis
// drafts don't crash the form on fields they predate.
function withDefaults(draft: InvoiceData): InvoiceData {
  const defaults = invoiceRepository.get();
  return {
    ...defaults,
    ...draft,
    payee: {
      ...defaults.payee,
      ...draft.payee,
      bank: {
        ...defaults.payee.bank,
        ...draft.payee?.bank,
      },
    },
  };
}

// Falls back to the bundled data/invoice.json seed until the first Save as
// PDF, or whenever Redis isn't configured (e.g. local dev without KV env vars).
export async function getInvoiceData(): Promise<InvoiceData> {
  const redis = getRedis();
  if (!redis) return invoiceRepository.get();
  return toInvoiceData(await readStored<InvoiceData>(INVOICE_DRAFT_KEY));
}

function toInvoiceData(stored: unknown): InvoiceData {
  return stored ? withDefaults(stored as InvoiceData) : invoiceRepository.get();
}

// The defaults editor's save: the whole document as the editor holds it, so
// the last save wins, as it does for any form saved whole.
export async function saveInvoiceData(data: InvoiceData): Promise<void> {
  const redis = requireRedis();
  await redis.set(INVOICE_DRAFT_KEY, data);
}

/**
 * Moves the invoice number seed to `next(seed)` and changes nothing else, by
 * compare-and-set (see lib/storeWrite.server.ts). For a write that raises an
 * invoice without the editor: resaving the whole defaults it read earlier
 * would undo an edit to them saved in the meantime.
 */
export function advanceInvoiceNumberSeed(next: (seed: string) => string): Promise<void> {
  return mutateStored(INVOICE_DRAFT_KEY, toInvoiceData, (data) => {
    const seed = next(data.invoiceNumberSeed);
    return {
      next: seed === data.invoiceNumberSeed ? null : { ...data, invoiceNumberSeed: seed },
      result: undefined,
    };
  });
}
