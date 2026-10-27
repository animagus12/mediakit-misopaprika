import "server-only";
import { findOrphanPayments, ledgerRows, type LedgerRow } from "@/lib/payments";
import { readSettledLedger } from "./invoices.writer.server";
import type { PaymentRecord } from "./payments";

// Reads of the payment ledger as a whole, rather than one deal's or invoice's
// slice of it: the Payments page and the dashboard's check for payments left
// without a deal. Writes stay in ./paymentLedger.server.

export interface PaymentBook {
  /** Every payment counted as income, newest first (see ledgerRows). */
  rows: LedgerRow[];
  /** Stored payments whose deal, renewal or invoice no longer exists. */
  orphans: PaymentRecord[];
}

export async function getPaymentBook(): Promise<PaymentBook> {
  const { campaigns, invoices, payments, settledInvoices } = await readSettledLedger();
  return {
    rows: ledgerRows(campaigns, settledInvoices),
    orphans: findOrphanPayments(payments, campaigns, invoices),
  };
}
