// The whole book of money as one list, and what it adds up to. Pure and
// client-safe.
//
// Nothing here is recorded twice. Money in is the payment ledger's rows
// (ledgerRows) and the affiliate payouts marked received; money out is the
// expenses and the editor workspace's paid jobs (outflowRows). This file only
// merges them, names them the same way everywhere (the Payments page and the
// CSV export share every label below), and adds them up.
//
// Two totals are kept apart on purpose:
//   * Cash flow is what moved through the accounts: what landed (after TDS
//     and bank charges) less what was paid out.
//   * Profit is what was earned less what it cost: income counts the TDS the
//     brands withheld (tax paid on the creator's behalf, claimed back when
//     filing) and barter received (income in goods), and costs count bank
//     charges. So profit less cash flow is always exactly TDS plus barter,
//     which is what the overview shows as the bridge between them.
// Both are on a receipts basis: money counts in the month it moved. What is
// still owed either way is reported beside them, never inside them.

import { isCampaignCalledOff, toIsoDate } from "@/lib/campaigns";
import { outflowCategoryLabel, type OutflowRow } from "@/lib/expenses";
import { financialYearOfMonth, financialYearStart, financialYearsPresent } from "@/lib/financialYear";
import { roundMoney, sumMoney } from "@/lib/money";
import { PAYERS, toPaymentMethod, type Payer, type PaymentMethod } from "@/lib/payers";
import type { LedgerRow } from "@/lib/payments";
import type { AffiliatePartner } from "@/repositories/affiliatePartners";
import type { AffiliatePayout } from "@/repositories/affiliatePayouts";
import type { Campaign } from "@/repositories/campaigns";
import type { Invoice } from "@/repositories/invoices";

export type MoneyFlow = "in" | "out";

/** The direction a `?flow=` search param asks for, or null for both. */
export function parseMoneyFlow(value: string | string[] | undefined | null): MoneyFlow | null {
  return value === "in" || value === "out" ? value : null;
}

// --- Affiliate commission ---------------------------------------------------------

/** One commission payout received, as money in. */
export interface CommissionRow {
  id: string;
  /** yyyy-mm-dd it was paid, or the day its period closed when no paid date was recorded. */
  date: string;
  estimated: boolean;
  fy: number | null;
  amount: number;
  /** The program's name. */
  partner: string;
  /** "01/09/2026 to 30/09/2026". */
  period: string;
  method: PaymentMethod | null;
}

/**
 * Every commission payout received, by the same rules earnings counts them
 * (summarizeEarnings): received ones only, by the day paid, else the day the
 * period closed.
 */
export function commissionRows(
  payouts: AffiliatePayout[],
  partners: Pick<AffiliatePartner, "id" | "name">[],
  fallbackName: string
): CommissionRow[] {
  const partnerName = new Map(partners.map((partner) => [partner.id, partner.name]));
  const rows: CommissionRow[] = [];
  for (const payout of payouts) {
    if (payout.paymentStatus === "pending" || payout.commissionAmount <= 0) continue;
    const paidOn = toIsoDate(payout.paidDate);
    const date = paidOn || toIsoDate(payout.periodEnd);
    if (!date) continue;
    rows.push({
      id: payout.id,
      date,
      estimated: paidOn === "",
      fy: financialYearStart(date),
      amount: roundMoney(payout.commissionAmount),
      partner: partnerName.get(payout.partnerId) ?? fallbackName,
      period: [payout.periodStart, payout.periodEnd].filter(Boolean).join(" to "),
      method: toPaymentMethod(payout.paymentMethod) ?? null,
    });
  }
  return rows;
}

// --- One list ---------------------------------------------------------------------

export type MoneyEntry =
  | { kind: "payment"; flow: "in"; row: LedgerRow }
  | { kind: "commission"; flow: "in"; row: CommissionRow }
  | { kind: "outflow"; flow: "out"; row: OutflowRow };

export function entryKey(entry: MoneyEntry): string {
  switch (entry.kind) {
    case "payment":
      return `payment:${entry.row.paymentId}`;
    case "commission":
      return `commission:${entry.row.id}`;
    case "outflow":
      return `${entry.row.source}:${entry.row.id}`;
  }
}

/** The day an entry is filed under: the day the money moved, or its stand-in. "" when there is none. */
export function entryDay(entry: MoneyEntry): string {
  return entry.kind === "payment" ? entry.row.bucketDate : entry.row.date;
}

/** The day the money actually moved, or "" for an old payment that never recorded one. */
export function entryDate(entry: MoneyEntry): string {
  return entry.row.date;
}

export function entryFy(entry: MoneyEntry): number | null {
  return entry.row.fy;
}

/** What it was worth: a payment's gross (before TDS and charges), a commission, a cost. Always positive. */
export function entryAmount(entry: MoneyEntry): number {
  return entry.kind === "payment" ? entry.row.gross : entry.row.amount;
}

/** What it did to the accounts: what landed for money in, less what left for money out. */
export function entryCash(entry: MoneyEntry): number {
  switch (entry.kind) {
    case "payment":
      return entry.row.net;
    case "commission":
      return entry.row.amount;
    case "outflow":
      return -entry.row.amount;
  }
}

/** Every transaction, newest first. */
export function moneyEntries(payments: LedgerRow[], commissions: CommissionRow[], outflows: OutflowRow[]): MoneyEntry[] {
  const entries: MoneyEntry[] = [
    ...payments.map((row): MoneyEntry => ({ kind: "payment", flow: "in", row })),
    ...commissions.map((row): MoneyEntry => ({ kind: "commission", flow: "in", row })),
    ...outflows.map((row): MoneyEntry => ({ kind: "outflow", flow: "out", row })),
  ];
  return entries.sort((a, b) => entryDay(b).localeCompare(entryDay(a)) || entryKey(a).localeCompare(entryKey(b)));
}

/** The financial years the filter offers: every year an entry falls in, plus the current one. */
export function moneyYears(entries: MoneyEntry[], now: Date = new Date()): number[] {
  return financialYearsPresent(entries.map(entryDay).filter(Boolean), now);
}

/** The entries in one direction (null for both) and one financial year (null for all years). */
export function filterEntries(
  entries: MoneyEntry[],
  filter: { flow: MoneyFlow | null; fy: number | null }
): MoneyEntry[] {
  return entries.filter(
    (entry) => (filter.flow === null || entry.flow === filter.flow) && (filter.fy === null || entryFy(entry) === filter.fy)
  );
}

// --- How an entry is named, everywhere ----------------------------------------------

const PAYMENT_CATEGORIES: Record<LedgerRow["target"]["kind"], string> = {
  deal: "Brand payment",
  renewal: "Usage renewal",
  invoice: "Invoice payment",
};

export function entryCategory(entry: MoneyEntry): string {
  switch (entry.kind) {
    case "payment":
      return PAYMENT_CATEGORIES[entry.row.target.kind];
    case "commission":
      return "Affiliate commission";
    case "outflow":
      return outflowCategoryLabel(entry.row.category);
  }
}

/** Who it was from or what it was: the brand, the program, or what was bought. */
export function entryTitle(entry: MoneyEntry): string {
  switch (entry.kind) {
    case "payment":
      return entry.row.brand;
    case "commission":
      return entry.row.partner;
    case "outflow":
      return entry.row.description || "Untitled";
  }
}

/** What it was for: the deal or invoice, the commission period, the editor and deal. */
export function entryDetail(entry: MoneyEntry): string {
  switch (entry.kind) {
    case "payment":
      return entry.row.targetLabel;
    case "commission":
      return entry.row.period ? `Commission for ${entry.row.period}` : "Commission";
    case "outflow":
      return [entry.row.editor, entry.row.dealLabel].filter(Boolean).join(" · ");
  }
}

/** Whose account the money landed in or came out of; null where it wasn't recorded. */
export function entryAccount(entry: MoneyEntry): Payer | null {
  switch (entry.kind) {
    case "payment":
      return entry.row.receivedInto;
    case "commission":
      return null;
    case "outflow":
      return entry.row.paidBy;
  }
}

export function entryMethod(entry: MoneyEntry): PaymentMethod | null {
  return entry.row.method;
}

/** Notes on where a figure comes from, worded for a person. */
export function entryFlags(entry: MoneyEntry): string[] {
  const flags: string[] = [];
  if (entry.kind === "payment" && entry.row.origin === "legacy") flags.push("From earlier record");
  if (entry.kind === "outflow" && entry.row.source === "editing") flags.push("From Editor workspace");
  if (entry.kind !== "payment" && entry.row.estimated) flags.push("Date estimated");
  return flags;
}

/**
 * Where an entry is changed: its deal (found by name in the campaigns table),
 * its invoice, the affiliates page or the editor workspace. Null for an
 * expense, which is edited where it is listed.
 */
export function entryHref(entry: MoneyEntry): string | null {
  switch (entry.kind) {
    case "payment":
      return entry.row.target.kind === "invoice"
        ? `/invoices/${entry.row.target.invoiceId}`
        : `/campaigns?q=${encodeURIComponent(entry.row.deal ?? "")}`;
    case "commission":
      return "/affiliates";
    case "outflow":
      return entry.row.source === "editing" ? "/workspace" : null;
  }
}

// --- What it adds up to -------------------------------------------------------------

export interface FlowTotals {
  /** Landed in the accounts: payments after TDS and charges, plus commission. */
  cashIn: number;
  /** Paid out: editing and expenses. */
  cashOut: number;
  /** cashIn less cashOut. */
  netCash: number;
  /** Payments before TDS and charges. */
  gross: number;
  tds: number;
  fees: number;
  commission: number;
  /** Barter received, at its value. */
  barter: number;
  /** gross + commission + barter. */
  income: number;
  /** cashOut + fees. */
  costs: number;
  /** income less costs; always netCash + tds + barter. */
  profit: number;
}

/** What `entries` add up to, with `barter` received over the same span (it is income, never a transaction). */
export function sumFlows(entries: MoneyEntry[], barter: number): FlowTotals {
  const of = (pick: (entry: MoneyEntry) => number) => sumMoney(entries.map(pick));
  const gross = of((entry) => (entry.kind === "payment" ? entry.row.gross : 0));
  const tds = of((entry) => (entry.kind === "payment" ? entry.row.tds : 0));
  const fees = of((entry) => (entry.kind === "payment" ? entry.row.fee : 0));
  const net = of((entry) => (entry.kind === "payment" ? entry.row.net : 0));
  const commission = of((entry) => (entry.kind === "commission" ? entry.row.amount : 0));
  const cashOut = of((entry) => (entry.kind === "outflow" ? entry.row.amount : 0));
  const cashIn = roundMoney(net + commission);
  const income = roundMoney(gross + commission + barter);
  const costs = roundMoney(cashOut + fees);
  return {
    cashIn,
    cashOut,
    netCash: roundMoney(cashIn - cashOut),
    gross,
    tds,
    fees,
    commission,
    barter: roundMoney(barter),
    income,
    costs,
    profit: roundMoney(income - costs),
  };
}

export interface FlowPeriod extends FlowTotals {
  /** "2026-10" for a month, "2026" (the start year) for a financial year. */
  period: string;
}

function groupFlows(
  entries: MoneyEntry[],
  barterByMonth: ReadonlyMap<string, number>,
  periodOf: (month: string) => string | null
): FlowPeriod[] {
  const entriesByPeriod = new Map<string, MoneyEntry[]>();
  const barterByPeriod = new Map<string, number>();
  for (const entry of entries) {
    const day = entryDay(entry);
    const period = day ? periodOf(day.slice(0, 7)) : null;
    if (!period) continue;
    const list = entriesByPeriod.get(period);
    if (list) list.push(entry);
    else entriesByPeriod.set(period, [entry]);
  }
  for (const [month, barter] of barterByMonth) {
    const period = periodOf(month);
    if (period && barter > 0) barterByPeriod.set(period, roundMoney((barterByPeriod.get(period) ?? 0) + barter));
  }
  const periods = [...new Set([...entriesByPeriod.keys(), ...barterByPeriod.keys()])].sort((a, b) => b.localeCompare(a));
  return periods.map((period) => ({
    period,
    ...sumFlows(entriesByPeriod.get(period) ?? [], barterByPeriod.get(period) ?? 0),
  }));
}

/**
 * Cash flow and profit month by month, newest first, over `entries` (an
 * undated entry belongs to no month and is left out) and the barter received
 * in each month (from summarizeEarnings).
 */
export function flowsByMonth(entries: MoneyEntry[], barterByMonth: ReadonlyMap<string, number>): FlowPeriod[] {
  return groupFlows(entries, barterByMonth, (month) => month);
}

/** The same by financial year, keyed by its start year. */
export function flowsByYear(entries: MoneyEntry[], barterByMonth: ReadonlyMap<string, number>): FlowPeriod[] {
  return groupFlows(entries, barterByMonth, (month) => {
    const year = financialYearOfMonth(month);
    return year === null ? null : String(year);
  });
}

export interface AccountFlow {
  /** null for money whose account wasn't recorded. */
  payer: Payer | null;
  /** Landed in this account. */
  cashIn: number;
  /** Paid out of it. */
  cashOut: number;
  net: number;
}

/**
 * Whose accounts the money went through: what landed in each and what each
 * paid out. A person's own account paying more out than came in is money they
 * put into the business.
 */
export function flowsByAccount(entries: MoneyEntry[]): AccountFlow[] {
  const payers: (Payer | null)[] = [...PAYERS, null];
  return payers
    .map((payer) => {
      const mine = entries.filter((entry) => entryAccount(entry) === payer);
      const cashIn = sumMoney(mine.filter((entry) => entry.flow === "in").map(entryCash));
      const cashOut = sumMoney(mine.filter((entry) => entry.flow === "out").map(entryAmount));
      return { payer, cashIn, cashOut, net: roundMoney(cashIn - cashOut) };
    })
    .filter((account) => account.cashIn > 0 || account.cashOut > 0);
}

/**
 * Cash brands owe right now and isn't in any total above: what is left on
 * deals and renewals still expected, on invoices that bill no deal and have
 * been sent, and commission reported but not paid. Called-off deals owe
 * nothing.
 */
export function cashOwedToYou(
  campaigns: Pick<Campaign, "status" | "paymentStatus" | "settlement" | "usage">[],
  invoices: Pick<Invoice, "owner" | "status" | "balanceDue">[],
  payouts: Pick<AffiliatePayout, "paymentStatus" | "commissionAmount">[]
): number {
  const owed: number[] = [];
  for (const campaign of campaigns) {
    if (isCampaignCalledOff(campaign.status)) continue;
    if (campaign.paymentStatus === "pending" && campaign.settlement) owed.push(campaign.settlement.remaining);
    for (const renewal of campaign.usage.renewals) {
      if (renewal.paymentStatus === "pending") owed.push(renewal.settlement.remaining);
    }
  }
  for (const invoice of invoices) {
    if (!invoice.owner && invoice.status === "sent") owed.push(invoice.balanceDue);
  }
  for (const payout of payouts) {
    if (payout.paymentStatus === "pending") owed.push(Math.max(0, payout.commissionAmount));
  }
  return sumMoney(owed);
}
