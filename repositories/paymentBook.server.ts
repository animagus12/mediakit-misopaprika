import "server-only";
import { computeEditorPayouts } from "@/lib/editorTransactions";
import { buildExpenseDealOptions, outflowRows, type ExpenseDealOption, type OutflowRow } from "@/lib/expenses";
import { findOrphanPayments, ledgerRows, type LedgerRow } from "@/lib/payments";
import { readCampaignLedger } from "./campaigns.writer.server";
import { getEditorTransactions } from "./editorTransactions.writer.server";
import { readExpenseRecords } from "./expenseRecords.server";
import type { ExpenseRecord } from "./expenses";
import { readSettledLedger } from "./invoices.writer.server";
import type { PaymentRecord } from "./payments";

// Reads of the money as a whole, rather than one deal's or invoice's slice of
// it: the Payments page's money in and money out, and the dashboard's check
// for payments left without a deal. Writes stay in ./paymentLedger.server and
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

export interface MoneyOut {
  /** Every expense and every paid editor job, newest first (see outflowRows). */
  rows: OutflowRow[];
  /** The expenses themselves, for editing one in place. */
  expenses: ExpenseRecord[];
  /** The deals an expense can be recorded against. */
  dealOptions: ExpenseDealOption[];
  /** Editor work done but not paid yet: owed, so not money out. */
  owedToEditors: number;
}

/**
 * Everything that went out: the expenses as recorded, and the editor
 * payments read straight from the workspace's transactions rather than
 * copied, so marking a job paid there lists it here.
 */
export async function getMoneyOut(): Promise<MoneyOut> {
  const [ledger, expenses, editorTransactions] = await Promise.all([
    readCampaignLedger(),
    readExpenseRecords(),
    getEditorTransactions(),
  ]);
  return {
    rows: outflowRows(expenses, editorTransactions, ledger.campaigns, ledger.invoices),
    expenses,
    dealOptions: buildExpenseDealOptions(ledger.campaigns),
    owedToEditors: computeEditorPayouts(editorTransactions).pending,
  };
}
