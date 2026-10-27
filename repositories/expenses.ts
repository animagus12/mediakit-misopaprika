// Money the business spent, other than paying editors: props for a shoot, a
// microphone, a software subscription, a courier. One record per purchase.
//
// Types and the pure coercion only, and deliberately no "server-only": the
// expense form validates against the same rules the server does, and the deal
// sheet renders a deal's costs. Storage lives in ./expenseRecords.server and
// ./expenses.writer.server; the joins in lib/expenses.ts.
//
// Editor payments are not expenses. They live on the editor workspace's
// transactions, and every reader that wants all the money that went out reads
// them from there (see lib/expenses.ts). Recording one here as well would
// count it twice, so the form offers no editing category.

import { roundMoney } from "@/lib/money";
import { toFinancialDayKey } from "@/lib/financialYear";
import {
  isPartner,
  toPartnerSettlement,
  toPayer,
  toPaymentMethod,
  type PartnerSettlement,
  type Payer,
  type PaymentMethod,
} from "@/lib/payers";

export const EXPENSE_CATEGORY_OPTIONS = [
  { value: "props", label: "Props" },
  { value: "equipment", label: "Equipment" },
  { value: "software", label: "Software" },
  { value: "travel", label: "Travel" },
  { value: "shipping", label: "Shipping" },
  { value: "other", label: "Miscellaneous" },
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORY_OPTIONS)[number]["value"];

export const EXPENSES_SEED_KEY = "expenses";
export const EXPENSE_DESCRIPTION_MAX = 120;
export const EXPENSE_NOTE_MAX = 500;

export interface ExpenseRecord {
  /** crypto.randomUUID(), made by the client once per opening of the form. */
  id: string;
  /** yyyy-mm-dd IST day key the money left. */
  date: string;
  /** > 0, at most 2 decimals. */
  amount: number;
  category: ExpenseCategory;
  /** What it was: "Spider-Man figure for the Blinkit reel". */
  description: string;
  /** Whose account it came out of; null only on a row written without one. */
  paidBy: Payer | null;
  /**
   * When a partner paid out of their own pocket: repaid from business funds,
   * or split 50/50 between the partners. Null while undecided, and always
   * null when the business account paid.
   */
  settlement: PartnerSettlement | null;
  method: PaymentMethod | null;
  /**
   * The deal it was spent for, by id. Its name is looked up on every read, so
   * a renamed deal never leaves a stale label behind, and a deal deleted to
   * Trash picks its expenses back up when restored.
   */
  campaignId: string | null;
  /** A photo or PDF of the receipt, as uploaded. */
  receiptUrl: string | null;
  note: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

/** What the form submits. */
export interface ExpenseInput {
  id: string;
  date: string;
  amount: number;
  category: ExpenseCategory;
  description: string;
  paidBy: Payer;
  settlement: PartnerSettlement | null;
  method: PaymentMethod | null;
  campaignId: string | null;
  receiptUrl: string | null;
  note: string;
}

export function isExpenseCategory(value: unknown): value is ExpenseCategory {
  return EXPENSE_CATEGORY_OPTIONS.some((option) => option.value === value);
}

/** "Miscellaneous" for "other"; the value itself for anything unknown. */
export function expenseCategoryLabel(category: ExpenseCategory): string {
  return EXPENSE_CATEGORY_OPTIONS.find((option) => option.value === category)?.label ?? category;
}

/** An uploaded receipt's address: https only, so a stored value can never be a script. */
export function toReceiptUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const url = value.trim();
  return /^https:\/\/\S+$/.test(url) ? url : null;
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/**
 * A record read back out of storage, coerced whole, or null when it cannot be
 * one (no id, no usable date, nothing spent). The same coerce-on-read every
 * other store gets, so a hand-edited row never reaches past the repository
 * half-formed.
 */
export function toExpenseRecord(raw: unknown): ExpenseRecord | null {
  if (typeof raw !== "object" || raw === null) return null;
  const candidate = raw as Record<string, unknown>;
  const id = typeof candidate.id === "string" ? candidate.id.trim() : "";
  const date = toFinancialDayKey(String(candidate.date ?? "")) ?? "";
  const amount = roundMoney(Math.max(0, Number(candidate.amount) || 0));
  if (!id || !date || amount <= 0) return null;
  const campaignId = typeof candidate.campaignId === "string" ? candidate.campaignId.trim() : "";
  const paidBy = toPayer(candidate.paidBy) ?? null;
  return {
    id,
    date,
    amount,
    category: isExpenseCategory(candidate.category) ? candidate.category : "other",
    description: text(candidate.description, EXPENSE_DESCRIPTION_MAX),
    paidBy,
    settlement: isPartner(paidBy) ? toPartnerSettlement(candidate.settlement) : null,
    method: toPaymentMethod(candidate.method) ?? null,
    campaignId: campaignId || null,
    receiptUrl: toReceiptUrl(candidate.receiptUrl),
    note: text(candidate.note, EXPENSE_NOTE_MAX),
    createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt : "",
    updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : "",
  };
}

/** The editing job a deal is costed with, read from the editor workspace. */
export interface DealEditingCost {
  transactionId: string;
  video: string;
  editor: string;
  /** What the job costs, revisions included; 0 while no amount is set. */
  amount: number;
  paid: boolean;
}

/**
 * Everything a deal cost to make, joined on when deals are read (see
 * attachDealCosts in lib/expenses.ts): never stored on the deal, so it moves
 * the moment an expense or the editing job changes.
 */
export interface DealCosts {
  editing: DealEditingCost | null;
  /** Expenses recorded against the deal, newest first. */
  expenses: ExpenseRecord[];
  /** Editing plus expenses. */
  total: number;
}
