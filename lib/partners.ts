// What the two partners owe each other and the business. Pure and
// client-safe.
//
// The business is shared 50/50. Money in always lands in the business
// account; a cost is paid either from that account or by one partner out of
// their own pocket. A cost a partner paid is settled one of two ways:
//   * repaid from business funds: the business owes that partner all of it;
//   * split 50/50: the other partner owes them half.
// Settle-ups (repositories/partnerTransfers.ts) record the money actually
// moving to square those up. Every figure here is derived from the costs, as
// recorded in the expenses and the editor workspace, and the settle-ups, so
// nothing is kept twice.
//
// Who paid never changes money in, money out or profit: a cost is the
// business's cost whoever paid it. This only says who is carrying it.

import { isDayKey } from "@/lib/day";
import type { OutflowRow } from "@/lib/expenses";
import { roundMoney, sumMoney } from "@/lib/money";
import { EARLIEST_PAYMENT_DAY, MAX_PAYMENT_GROSS } from "@/lib/payments";
import {
  PARTNERS,
  isPartner,
  isPayer,
  otherPartner,
  payerLabel,
  type Partner,
  type PartnerSettlement,
  type Payer,
} from "@/lib/payers";
import { PARTNER_TRANSFER_NOTE_MAX, type PartnerTransferInput, type PartnerTransferRecord } from "@/repositories/partnerTransfers";

/** One cost a partner paid out of their own pocket. */
export interface PartnerCost {
  source: OutflowRow["source"];
  id: string;
  date: string;
  amount: number;
  description: string;
  /** What it was for: the editor, the deal. */
  detail: string;
  paidBy: Partner;
  settlement: PartnerSettlement | null;
}

/** Every cost paid by a partner, newest first, from the money-out rows. */
export function partnerCosts(outflows: OutflowRow[]): PartnerCost[] {
  const costs: PartnerCost[] = [];
  for (const row of outflows) {
    if (!isPartner(row.paidBy)) continue;
    costs.push({
      source: row.source,
      id: row.id,
      date: row.date,
      amount: row.amount,
      description: row.description || "Untitled",
      detail: [row.editor, row.dealLabel].filter(Boolean).join(" · "),
      paidBy: row.paidBy,
      settlement: row.settlement,
    });
  }
  return costs.sort((a, b) => b.date.localeCompare(a.date));
}

/** One balance: `from` owes `to` `amount`. */
export interface Debt {
  from: Payer;
  to: Payer;
  amount: number;
}

export interface PartnerSummary {
  /** What each partner has paid for the business out of their own pocket, all time. */
  paid: { partner: Partner; amount: number }[];
  /** Who owes whom right now, after every settle-up, biggest first; empty when everyone is square. */
  debts: Debt[];
  /** Costs a partner paid that are neither repaid nor split yet, newest first. */
  toSettle: PartnerCost[];
}

// The three pairs money can be owed across. Each is netted to one figure, so
// "the business owes Ritika 500" and "Ritika owes the business 200" read as
// the business owing Ritika 300.
const PAIRS: [Payer, Payer][] = [
  ["business", "subhrajit"],
  ["business", "ritika"],
  ["subhrajit", "ritika"],
];

/**
 * Who owes whom, from the costs the partners paid and the settle-ups since.
 *
 * Repaid from business funds: the business owes the partner the whole cost.
 * Split 50/50: the other partner owes half. A settle-up from one to another
 * pays that down, and paying more than was owed turns the balance round.
 */
export function summarizePartners(costs: PartnerCost[], transfers: PartnerTransferRecord[]): PartnerSummary {
  const owed = new Map<string, number>();
  const owe = (from: Payer, to: Payer, amount: number) => {
    const key = `${from}>${to}`;
    owed.set(key, roundMoney((owed.get(key) ?? 0) + amount));
  };

  for (const cost of costs) {
    if (cost.settlement === "business") owe("business", cost.paidBy, cost.amount);
    else if (cost.settlement === "split") owe(otherPartner(cost.paidBy), cost.paidBy, roundMoney(cost.amount / 2));
  }
  for (const transfer of transfers) owe(transfer.from, transfer.to, -transfer.amount);

  const debts: Debt[] = [];
  for (const [a, b] of PAIRS) {
    const net = roundMoney((owed.get(`${a}>${b}`) ?? 0) - (owed.get(`${b}>${a}`) ?? 0));
    if (net > 0) debts.push({ from: a, to: b, amount: net });
    else if (net < 0) debts.push({ from: b, to: a, amount: -net });
  }

  return {
    paid: PARTNERS.map((partner) => ({
      partner,
      amount: sumMoney(costs.filter((cost) => cost.paidBy === partner).map((cost) => cost.amount)),
    })),
    debts: debts.sort((x, y) => y.amount - x.amount),
    toSettle: costs.filter((cost) => cost.settlement === null),
  };
}

/** "Business funds owe Ritika", "Ritika owes Subhrajit". */
export function debtLabel(debt: Pick<Debt, "from" | "to">): string {
  const verb = debt.from === "business" ? "owe" : "owes";
  return `${payerLabel(debt.from)} ${verb} ${payerLabel(debt.to)}`;
}

/** "Ritika paid Subhrajit", "Business funds paid Ritika": how a settle-up is named. */
export function settleUpLabel(transfer: Pick<PartnerTransferRecord, "from" | "to">): string {
  return `${payerLabel(transfer.from)} paid ${payerLabel(transfer.to)}`;
}

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** The first thing wrong with a settle-up, or null when it can be saved. Shared by the form and the server. */
export function validateSettleUp(input: PartnerTransferInput, today: string): string | null {
  if (!UUID_V4.test(input.id)) return "This settle-up's id isn't valid. Reopen the form and try again.";
  if (!isDayKey(input.date)) return "Pick the day the money moved";
  if (input.date > today) return "A settle-up can't be dated in the future";
  if (input.date < EARLIEST_PAYMENT_DAY) return "That date is too early";
  if (!isPayer(input.from) || !isPayer(input.to)) return "Choose who paid and who was paid";
  if (input.from === input.to) return "Choose two different people";
  if (!Number.isFinite(input.amount) || roundMoney(input.amount) !== input.amount || input.amount <= 0 || input.amount > MAX_PAYMENT_GROSS) {
    return "Enter the amount, up to two decimals";
  }
  if (typeof input.note !== "string" || input.note.length > PARTNER_TRANSFER_NOTE_MAX) {
    return `Keep the note to ${PARTNER_TRANSFER_NOTE_MAX} characters`;
  }
  return null;
}
