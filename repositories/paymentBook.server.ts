import "server-only";
import { computeEditorPayouts } from "@/lib/editorTransactions";
import { buildExpenseDealOptions, outflowRows, type ExpenseDealOption } from "@/lib/expenses";
import { cashOwedToYou, commissionRows, moneyEntries, type MoneyEntry } from "@/lib/moneyBook";
import { findOrphanPayments, ledgerRows, type LedgerRow } from "@/lib/payments";
import { getAffiliatePartners } from "./affiliatePartners.writer.server";
import { getAffiliatePayouts } from "./affiliatePayouts.writer.server";
import { AFFILIATE_FALLBACK_NAME, summarizeEarnings, toEarningsPayouts } from "./earnings";
import { getEditorTransactions } from "./editorTransactions.writer.server";
import { readExpenseRecords } from "./expenseRecords.server";
import type { ExpenseRecord } from "./expenses";
import { readSettledLedger } from "./invoices.writer.server";
import type { PaymentRecord } from "./payments";

// Reads of the money as a whole, rather than one deal's or invoice's slice of
// it: the Payments page and its CSV export, and the dashboard's check for
// payments left without a deal. Writes stay in ./paymentLedger.server and
// ./expenses.writer.server.

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

export interface MoneyBook {
  /** Every transaction in and out, newest first (see lib/moneyBook.ts). */
  entries: MoneyEntry[];
  /** Barter received, by "YYYY-MM": income for profit, but never a transaction. */
  barterByMonth: Map<string, number>;
  /** Stored payments whose deal, renewal or invoice no longer exists. */
  orphans: PaymentRecord[];
  /** The expenses as recorded, for editing one where it is listed. */
  expenses: ExpenseRecord[];
  /** The deals an expense can be recorded against. */
  dealOptions: ExpenseDealOption[];
  /** Cash brands and programs owe right now (see cashOwedToYou). */
  owedToYou: number;
  /** Editor work done and not paid yet. */
  owedToEditors: number;
}

/**
 * Every rupee in and out, each read from where it is recorded: payments from
 * the ledger, commission from the affiliate payouts, editor payments from the
 * workspace's transactions, and expenses. Nothing is copied, so a change in
 * any of them shows here on the next read. Affiliate stores degrade to empty,
 * as they do for earnings: missing commission is a smaller failure than a
 * page with no money on it at all.
 */
export async function getMoneyBook(): Promise<MoneyBook> {
  const [ledger, expenses, editorTransactions, partners, payouts] = await Promise.all([
    readSettledLedger(),
    readExpenseRecords(),
    getEditorTransactions(),
    getAffiliatePartners().catch(() => []),
    getAffiliatePayouts().catch(() => []),
  ]);
  const earnings = summarizeEarnings(ledger.campaigns, toEarningsPayouts(payouts, partners), ledger.settledInvoices);
  return {
    entries: moneyEntries(
      ledgerRows(ledger.campaigns, ledger.settledInvoices),
      commissionRows(payouts, partners, AFFILIATE_FALLBACK_NAME),
      outflowRows(expenses, editorTransactions, ledger.campaigns, ledger.invoices)
    ),
    barterByMonth: new Map(earnings.monthly.map((month) => [month.month, month.barter])),
    orphans: findOrphanPayments(ledger.payments, ledger.campaigns, ledger.invoices),
    expenses,
    dealOptions: buildExpenseDealOptions(ledger.campaigns),
    owedToYou: cashOwedToYou(ledger.campaigns, ledger.settledInvoices, payouts),
    owedToEditors: computeEditorPayouts(editorTransactions).pending,
  };
}
