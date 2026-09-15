import "server-only";
import { getRedis } from "@/lib/cache";
import invoicesSeed from "@/data/invoices.json";
import type { InvoiceRecord } from "./invoices";

// The invoices as stored, with nothing joined onto them. Its own module so
// campaigns.writer.server can read invoice due dates without importing
// invoices.writer.server, which already imports campaigns for each invoice's
// brand: the two reads would otherwise call each other forever.
export const INVOICES_KEY = "invoices";
const SEED = invoicesSeed as InvoiceRecord[];

// Falls back to the bundled data/invoices.json seed (empty) until the first
// invoice is saved, or whenever Redis isn't configured.
export async function readInvoiceRecords(): Promise<InvoiceRecord[]> {
  const redis = getRedis();
  if (!redis) return SEED;
  const stored = await redis.get<InvoiceRecord[]>(INVOICES_KEY);
  return stored ?? SEED;
}
