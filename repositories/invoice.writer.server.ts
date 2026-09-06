import "server-only";
import { getRedis } from "@/lib/cache";
import { invoiceRepository, type InvoiceData } from "./invoice";

// server-only, and never imported from a client component: the server
// actions and pages that need it import it directly. Reading/writing the
// invoice draft goes through Redis (Vercel's serverless filesystem is
// read-only), so that logic lives here rather than in ./invoice.
const INVOICE_DRAFT_KEY = "invoice_draft";
const REDIS_NOT_CONFIGURED = "Upstash Redis not configured: set KV_REST_API_URL and KV_REST_API_TOKEN";

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
  const draft = await redis.get<InvoiceData>(INVOICE_DRAFT_KEY);
  return draft ? withDefaults(draft) : invoiceRepository.get();
}

export async function saveInvoiceData(data: InvoiceData): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  await redis.set(INVOICE_DRAFT_KEY, data);
}
