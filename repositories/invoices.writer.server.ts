import "server-only";
import { getRedis } from "@/lib/cache";
import invoicesSeed from "@/data/invoices.json";
import type { RecordChange } from "@/lib/activityDiff";
import { toInvoice } from "./invoices";
import type { Invoice, InvoiceRecord, InvoiceStatus, InvoiceUpdate, NewInvoice } from "./invoices";

// server-only, and never imported from a client component: the server
// actions and pages that need it import it directly. Reading/writing
// invoices goes through Redis (Vercel's serverless filesystem is read-only),
// so that logic lives here rather than in ./invoices.
const INVOICES_KEY = "invoices";
const REDIS_NOT_CONFIGURED = "Upstash Redis not configured: set KV_REST_API_URL and KV_REST_API_TOKEN";
const SEED = invoicesSeed as InvoiceRecord[];

async function readRecords(): Promise<InvoiceRecord[]> {
  const redis = getRedis();
  if (!redis) return SEED;
  const stored = await redis.get<InvoiceRecord[]>(INVOICES_KEY);
  return stored ?? SEED;
}

// Falls back to the bundled data/invoices.json seed (empty) until the first
// invoice is saved, or whenever Redis isn't configured (e.g. local dev
// without KV env vars).
export async function getInvoices(): Promise<Invoice[]> {
  return (await readRecords()).map(toInvoice);
}

export async function getInvoice(id: string): Promise<Invoice | null> {
  const record = (await readRecords()).find((r) => r.id === id);
  return record ? toInvoice(record) : null;
}

// Trims free text and coerces numbers so a record is clean regardless of what
// the form handed over: same defensive shape as brands.writer.server.ts.
function normalize(input: NewInvoice): NewInvoice {
  return {
    status: input.status,
    invoiceNo: input.invoiceNo.trim(),
    brandId: input.brandId?.trim() || null,
    editorTransactionId: input.editorTransactionId?.trim() || null,
    campaignName: input.campaignName.trim(),
    issueDate: input.issueDate,
    dueDate: input.dueDate,
    client: {
      name: input.client.name.trim(),
      contactName: input.client.contactName.trim(),
      email: input.client.email.trim(),
    },
    items: input.items.map((item) => ({
      desc: item.desc.trim(),
      sub: item.sub.trim(),
      qty: Number(item.qty) || 0,
      price: Number(item.price) || 0,
    })),
    advance: Number(input.advance) || 0,
    barter: {
      enabled: input.barter.enabled,
      value: Number(input.barter.value) || 0,
      status: input.barter.status.trim(),
    },
    payment: {
      payeeName: input.payment.payeeName.trim(),
      payeeEmail: input.payment.payeeEmail.trim(),
      mode: input.payment.mode,
      upi: input.payment.upi.trim(),
      bank: {
        accountName: input.payment.bank.accountName.trim(),
        accountNumber: input.payment.bank.accountNumber.trim(),
        ifsc: input.payment.bank.ifsc.trim(),
        bankName: input.payment.bank.bankName.trim(),
      },
      footerNote: input.payment.footerNote.trim(),
      closingLine: input.payment.closingLine.trim(),
      qrImage: input.payment.qrImage,
      stampImage: input.payment.stampImage,
    },
  };
}

export async function addInvoice(input: NewInvoice): Promise<InvoiceRecord> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  const records = await readRecords();
  const now = new Date().toISOString();
  const record: InvoiceRecord = {
    id: crypto.randomUUID(),
    ...normalize(input),
    createdAt: now,
    updatedAt: now,
  };
  await redis.set(INVOICES_KEY, [...records, record]);
  return record;
}

/**
 * Answers the record either side of this write, or null when the id matched
 * nothing.
 *
 * Both records rather than a flag, so a caller can tell an ordinary edit from
 * collecting payment, and can say which fields moved, without re-reading a
 * store this call already read. Comparing against `input` would not do:
 * normalize() trims and coerces, so a trailing space would read as an edit.
 */
export async function updateInvoice(input: InvoiceUpdate): Promise<RecordChange<InvoiceRecord> | null> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  const records = await readRecords();
  const before = records.find((record) => record.id === input.id);
  if (!before) return null;
  const after: InvoiceRecord = { ...before, ...normalize(input), updatedAt: new Date().toISOString() };
  await redis.set(INVOICES_KEY, records.map((record) => (record.id === input.id ? after : record)));
  return { before, after };
}

// Writes just the status, leaving every other field untouched: mirrors
// setCampaignPaymentStatus in campaigns.writer.server.ts, and backs the
// dashboard's "Mark received" keeping a linked invoice in step.
export async function setInvoiceStatus(id: string, status: InvoiceStatus): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  const records = await readRecords();
  if (!records.some((record) => record.id === id)) throw new Error(`Invoice "${id}" not found`);
  await redis.set(
    INVOICES_KEY,
    records.map((record): InvoiceRecord =>
      record.id === id ? { ...record, status, updatedAt: new Date().toISOString() } : record
    )
  );
}

// Returns the invoice it removed, or null when the id matched nothing: see
// deleteBrand in brands.writer.server.ts for why.
export async function deleteInvoice(id: string): Promise<InvoiceRecord | null> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  const records = await readRecords();
  const removed = records.find((record) => record.id === id) ?? null;
  await redis.set(
    INVOICES_KEY,
    records.filter((record) => record.id !== id)
  );
  return removed;
}
