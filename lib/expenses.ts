// The money that went out, as every reader sees it. Pure and client-safe.
//
// Two sources and never a copy of either: expenses recorded on the Payments
// page, and the editor workspace's transactions, which already say what each
// edit cost, whether it is paid, when, by whom and how. An editor payment is
// read from the workspace wherever outgoing money is shown, so recording it
// once there is enough, and changing it there moves every figure here.
//
// Expenses and editing jobs are tied to deals by id only. A deal's name, and
// whether it still exists, are looked up on every read.

import { campaignLabel, toIsoDate } from "@/lib/campaigns";
import { isDayKey } from "@/lib/day";
import { isPaidEditorStatus } from "@/lib/editorTransactions";
import { financialYearStart } from "@/lib/financialYear";
import { holdsEditorJob } from "@/lib/invoice";
import { roundMoney, sumMoney } from "@/lib/money";
import { EARLIEST_PAYMENT_DAY, MAX_PAYMENT_GROSS } from "@/lib/payments";
import {
  PAYERS,
  isPartner,
  isPartnerSettlement,
  isPayer,
  isPaymentMethod,
  toPartnerSettlement,
  toPayer,
  toPaymentMethod,
  type PartnerSettlement,
  type Payer,
  type PaymentMethod,
} from "@/lib/payers";
import type { Campaign } from "@/repositories/campaigns";
import type { EditorTransactionRecord } from "@/repositories/editorTransactions";
import {
  EXPENSE_DESCRIPTION_MAX,
  EXPENSE_NOTE_MAX,
  expenseCategoryLabel,
  isExpenseCategory,
  toReceiptUrl,
  type DealCosts,
  type DealEditingCost,
  type ExpenseCategory,
  type ExpenseInput,
  type ExpenseRecord,
} from "@/repositories/expenses";
import type { InvoiceRecord } from "@/repositories/invoices";

// --- Validation -------------------------------------------------------------------

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Server only: a new expense's id must be the form's UUID, which is what makes a double tap save once. */
export function validateNewExpenseId(id: string): string | null {
  return UUID_V4.test(id) ? null : "This expense's id isn't valid. Reopen the form and try again.";
}

function isRoundedAmount(value: number): boolean {
  return Number.isFinite(value) && roundMoney(value) === value;
}

/**
 * The first thing wrong with an expense, as a sentence to show beside the
 * form, or null when it can be saved. Shared by the form and the server, so
 * both refuse the same things in the same order.
 */
export function validateExpense(input: ExpenseInput, today: string): string | null {
  if (!isDayKey(input.date)) return "Pick the day the money went out";
  if (input.date > today) return "An expense can't be dated in the future";
  if (input.date < EARLIEST_PAYMENT_DAY) return "That date is too early";
  if (!isRoundedAmount(input.amount) || input.amount <= 0 || input.amount > MAX_PAYMENT_GROSS) {
    return "Enter the amount spent, up to two decimals";
  }
  if (typeof input.description !== "string" || !input.description.trim()) return "Say what it was";
  if (input.description.trim().length > EXPENSE_DESCRIPTION_MAX) {
    return `Keep the description to ${EXPENSE_DESCRIPTION_MAX} characters`;
  }
  if (!isExpenseCategory(input.category)) return "Pick a category";
  if (!isPayer(input.paidBy)) return "Choose whose account it came out of";
  if (input.settlement !== null && !isPartnerSettlement(input.settlement)) return "Choose how it is settled";
  if (input.method !== null && !isPaymentMethod(input.method)) return "Choose a payment method from the list";
  if (input.campaignId !== null && (typeof input.campaignId !== "string" || !input.campaignId.trim())) {
    return "Pick the deal it was for, or no deal";
  }
  if (input.receiptUrl !== null && toReceiptUrl(input.receiptUrl) === null) {
    return "That receipt didn't upload properly. Upload it again.";
  }
  if (typeof input.note !== "string" || input.note.length > EXPENSE_NOTE_MAX) {
    return `Keep the note to ${EXPENSE_NOTE_MAX} characters`;
  }
  return null;
}

/**
 * What a new expense's form starts from: whose account and which method the
 * last one recorded used, so the second purchase of a shopping trip is a
 * description and an amount away.
 */
export function lastExpenseDefaults(expenses: ExpenseRecord[]): { paidBy: Payer; method: PaymentMethod | null } {
  const last = [...expenses].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  return { paidBy: last?.paidBy ?? "business", method: last?.method ?? null };
}

// --- Deals ------------------------------------------------------------------------

/** "Blinkit · Rakhi Cookies": how a list of money names the deal a row was for. */
export function dealName(campaign: Pick<Campaign, "brand" | "campaign">): string {
  return [campaign.brand.trim(), campaign.campaign.trim()].filter(Boolean).join(" · ") || campaignLabel("", "");
}

export const DELETED_DEAL_LABEL = "A deleted deal";

/** One deal an expense can be recorded against, for the form's picker. */
export interface ExpenseDealOption {
  id: string;
  label: string;
}

/** Every deal, newest first: props are bought for called-off deals too. */
export function buildExpenseDealOptions(
  campaigns: Pick<Campaign, "id" | "brand" | "campaign" | "date">[]
): ExpenseDealOption[] {
  return [...campaigns]
    .sort((a, b) => toIsoDate(b.date).localeCompare(toIsoDate(a.date)))
    .map((campaign) => ({ id: campaign.id, label: dealName(campaign) }));
}

/**
 * The editing job a deal is costed with: the one linked on the deal itself,
 * else the one its invoice bills against for its margin. Both links already
 * exist for their own reasons, so a deal is costed without asking again.
 */
function dealEditingJobId(
  campaign: Pick<Campaign, "editorTransactionId" | "invoiceId">,
  invoices: ReadonlyMap<string, Pick<InvoiceRecord, "status" | "editorTransactionId">>
): string | null {
  if (campaign.editorTransactionId) return campaign.editorTransactionId;
  const invoice = campaign.invoiceId ? invoices.get(campaign.invoiceId) : undefined;
  return invoice && holdsEditorJob(invoice) ? invoice.editorTransactionId : null;
}

/** Which deal each editing job is costed to, keyed by transaction id. The first deal wins. */
function editingJobDeals(
  campaigns: Campaign[],
  invoices: ReadonlyMap<string, Pick<InvoiceRecord, "status" | "editorTransactionId">>
): Map<string, Campaign> {
  const owners = new Map<string, Campaign>();
  for (const campaign of campaigns) {
    const jobId = dealEditingJobId(campaign, invoices);
    if (jobId && !owners.has(jobId)) owners.set(jobId, campaign);
  }
  return owners;
}

function toEditingCost(transaction: EditorTransactionRecord | undefined): DealEditingCost | null {
  // A cancelled cut never happened commercially, the convention every editor
  // figure already follows.
  if (!transaction || transaction.status.trim().toLowerCase() === "cancelled") return null;
  return {
    transactionId: transaction.id,
    video: transaction.video.trim(),
    editor: transaction.editor.trim(),
    amount: roundMoney(Math.max(0, transaction.amount ?? 0)),
    paid: isPaidEditorStatus(transaction.status),
  };
}

function newestFirst(a: { date: string; createdAt: string }, b: { date: string; createdAt: string }): number {
  return b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);
}

/**
 * Every deal with what it cost to make joined on: its editing job and the
 * expenses recorded against it. Derived on every read, so an expense added on
 * the Payments page or an editor's amount changed in the workspace shows on
 * the deal at once, with nothing written to the deal itself.
 */
export function attachDealCosts(
  campaigns: Campaign[],
  invoices: Pick<InvoiceRecord, "id" | "status" | "editorTransactionId">[],
  expenses: ExpenseRecord[],
  editorTransactions: EditorTransactionRecord[]
): Campaign[] {
  const invoiceById = new Map(invoices.map((invoice) => [invoice.id, invoice]));
  const transactionById = new Map(editorTransactions.map((transaction) => [transaction.id, transaction]));
  const expensesByDeal = new Map<string, ExpenseRecord[]>();
  for (const expense of expenses) {
    if (!expense.campaignId) continue;
    const list = expensesByDeal.get(expense.campaignId);
    if (list) list.push(expense);
    else expensesByDeal.set(expense.campaignId, [expense]);
  }
  // One job costs one deal: a second deal pointing at the same edit would
  // count its cost twice across the book.
  const jobOwners = editingJobDeals(campaigns, invoiceById);

  return campaigns.map((campaign) => {
    const jobId = dealEditingJobId(campaign, invoiceById);
    const editing = jobId && jobOwners.get(jobId)?.id === campaign.id ? toEditingCost(transactionById.get(jobId)) : null;
    const dealExpenses = [...(expensesByDeal.get(campaign.id) ?? [])].sort(newestFirst);
    const costs: DealCosts = {
      editing,
      expenses: dealExpenses,
      total: sumMoney([editing?.amount ?? 0, ...dealExpenses.map((expense) => expense.amount)]),
    };
    return { ...campaign, costs };
  });
}

/**
 * What a deal leaves once its costs are paid: its cash, renewals included,
 * less editing and expenses. Barter is left out because it can't pay a cost.
 * Null when the deal's costs weren't read.
 */
export function dealCashAfterCosts(
  campaign: Pick<Campaign, "cash" | "costs" | "usage">
): { cash: number; costs: number; kept: number } | null {
  if (!campaign.costs) return null;
  const cash = sumMoney([campaign.cash, ...campaign.usage.renewals.map((renewal) => renewal.amount)]);
  return { cash, costs: campaign.costs.total, kept: roundMoney(cash - campaign.costs.total) };
}

// --- Money out ----------------------------------------------------------------------

export type OutflowCategory = ExpenseCategory | "editing";

export function outflowCategoryLabel(category: OutflowCategory): string {
  return category === "editing" ? "Editing" : expenseCategoryLabel(category);
}

/** One sum of money that went out, as the Payments page and the year's export list it. */
export interface OutflowRow {
  /** The expense's id, or the editor transaction's. */
  id: string;
  source: "expense" | "editing";
  /** yyyy-mm-dd the money left. */
  date: string;
  /**
   * An editor payment marked paid before paid dates were recorded: `date` is
   * the day the cut was delivered (or assigned), not the day it was paid.
   */
  estimated: boolean;
  /** Start year of the financial year `date` falls in. */
  fy: number | null;
  amount: number;
  category: OutflowCategory;
  /** The expense's description, or the video that was edited. */
  description: string;
  /** Who edited, on an editor payment. */
  editor: string | null;
  campaignId: string | null;
  /** The deal's name now; DELETED_DEAL_LABEL when its id no longer resolves; null for no deal. */
  dealLabel: string | null;
  paidBy: Payer | null;
  /** How a cost a partner paid is settled (see lib/partners.ts); null when undecided or the business paid. */
  settlement: PartnerSettlement | null;
  method: PaymentMethod | null;
  receiptUrl: string | null;
  note: string;
}

function dealLabelFor(campaignId: string | null, deals: ReadonlyMap<string, Campaign>): string | null {
  if (!campaignId) return null;
  const deal = deals.get(campaignId);
  return deal ? dealName(deal) : DELETED_DEAL_LABEL;
}

/**
 * Every sum that went out, newest first: each expense, and each editor job
 * marked paid in the workspace (by the day it was paid, or by its delivery
 * date and flagged as estimated when it predates paid dates). Editor work not
 * yet paid isn't here: it hasn't left the account.
 */
export function outflowRows(
  expenses: ExpenseRecord[],
  editorTransactions: EditorTransactionRecord[],
  campaigns: Campaign[],
  invoices: Pick<InvoiceRecord, "id" | "status" | "editorTransactionId">[]
): OutflowRow[] {
  const deals = new Map(campaigns.map((campaign) => [campaign.id, campaign]));
  const jobOwners = editingJobDeals(campaigns, new Map(invoices.map((invoice) => [invoice.id, invoice])));
  const rows: OutflowRow[] = expenses.map((expense) => ({
    id: expense.id,
    source: "expense",
    date: expense.date,
    estimated: false,
    fy: financialYearStart(expense.date),
    amount: expense.amount,
    category: expense.category,
    description: expense.description,
    editor: null,
    campaignId: expense.campaignId,
    dealLabel: dealLabelFor(expense.campaignId, deals),
    paidBy: expense.paidBy,
    settlement: expense.settlement,
    method: expense.method,
    receiptUrl: expense.receiptUrl,
    note: expense.note,
  }));

  for (const transaction of editorTransactions) {
    if (!isPaidEditorStatus(transaction.status)) continue;
    const amount = roundMoney(Math.max(0, transaction.amount ?? 0));
    if (amount === 0) continue;
    const paidOn = toIsoDate(transaction.paidDate ?? "");
    const date = paidOn || toIsoDate(transaction.deliveryDate) || toIsoDate(transaction.videoDate);
    if (!date) continue;
    const deal = jobOwners.get(transaction.id) ?? null;
    const paidBy = toPayer(transaction.paidBy) ?? null;
    rows.push({
      id: transaction.id,
      source: "editing",
      date,
      estimated: paidOn === "",
      fy: financialYearStart(date),
      amount,
      category: "editing",
      description: transaction.video.trim(),
      editor: transaction.editor.trim() || null,
      campaignId: deal?.id ?? null,
      dealLabel: deal ? dealName(deal) : null,
      paidBy,
      settlement: isPartner(paidBy) ? toPartnerSettlement(transaction.settlement) : null,
      method: toPaymentMethod(transaction.paymentMethod) ?? null,
      receiptUrl: null,
      note: "",
    });
  }

  return rows.sort((a, b) => b.date.localeCompare(a.date) || a.description.localeCompare(b.description));
}

export interface OutflowTotals {
  total: number;
  editing: number;
  expenses: number;
  /** The part of `editing` filed by an estimated date. */
  estimated: number;
  /** Every category with money in it, biggest first. */
  byCategory: { category: OutflowCategory; amount: number }[];
  /** Whose account it came out of, in the usual order; `payer` null for "not recorded". */
  byPayer: { payer: Payer | null; amount: number }[];
}

export function summarizeOutflows(rows: OutflowRow[]): OutflowTotals {
  const sum = (match: (row: OutflowRow) => boolean) => sumMoney(rows.filter(match).map((row) => row.amount));
  const categories = [...new Set(rows.map((row) => row.category))];
  const payers: (Payer | null)[] = [...PAYERS, null];
  return {
    total: sum(() => true),
    editing: sum((row) => row.source === "editing"),
    expenses: sum((row) => row.source === "expense"),
    estimated: sum((row) => row.estimated),
    byCategory: categories
      .map((category) => ({ category, amount: sum((row) => row.category === category) }))
      .sort((a, b) => b.amount - a.amount),
    byPayer: payers
      .map((payer) => ({ payer, amount: sum((row) => row.paidBy === payer) }))
      .filter((entry) => entry.amount > 0),
  };
}

/**
 * What expenses took out of each month, keyed "YYYY-MM" like the earnings
 * months, for the margin line under the earnings chart.
 */
export function expenseCostByMonth(expenses: Pick<ExpenseRecord, "date" | "amount">[]): Map<string, number> {
  const byMonth = new Map<string, number>();
  for (const expense of expenses) {
    const month = expense.date.slice(0, 7);
    byMonth.set(month, roundMoney((byMonth.get(month) ?? 0) + expense.amount));
  }
  return byMonth;
}
