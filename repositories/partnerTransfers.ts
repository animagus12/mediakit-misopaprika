// Settle-ups: money moved between the two partners and the business account
// to square up a cost one partner paid out of their own pocket (see
// lib/partners.ts). The business repaying a partner, or one partner paying
// the other their half.
//
// Never income and never a cost: the cost was counted when it was paid, so a
// settle-up only moves who carries it. Types and the pure coercion only;
// storage lives in ./partnerTransferRecords.server and
// ./partnerTransfers.writer.server.

import { roundMoney } from "@/lib/money";
import { toFinancialDayKey } from "@/lib/financialYear";
import { toPayer, type Payer } from "@/lib/payers";

export const PARTNER_TRANSFERS_SEED_KEY = "partner_transfers";
export const PARTNER_TRANSFER_NOTE_MAX = 200;

export interface PartnerTransferRecord {
  /** crypto.randomUUID(), made by the client once per opening of the form. */
  id: string;
  /** yyyy-mm-dd the money moved. */
  date: string;
  from: Payer;
  to: Payer;
  /** > 0, at most 2 decimals. */
  amount: number;
  note: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

/** What the settle-up form submits. */
export interface PartnerTransferInput {
  id: string;
  date: string;
  from: Payer;
  to: Payer;
  amount: number;
  note: string;
}

/** A settle-up read back out of storage, or null when it cannot be one. */
export function toPartnerTransferRecord(raw: unknown): PartnerTransferRecord | null {
  if (typeof raw !== "object" || raw === null) return null;
  const candidate = raw as Record<string, unknown>;
  const id = typeof candidate.id === "string" ? candidate.id.trim() : "";
  const date = toFinancialDayKey(String(candidate.date ?? "")) ?? "";
  const from = toPayer(candidate.from);
  const to = toPayer(candidate.to);
  const amount = roundMoney(Math.max(0, Number(candidate.amount) || 0));
  if (!id || !date || !from || !to || from === to || amount <= 0) return null;
  return {
    id,
    date,
    from,
    to,
    amount,
    note: typeof candidate.note === "string" ? candidate.note.trim().slice(0, PARTNER_TRANSFER_NOTE_MAX) : "",
    createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt : "",
    updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : "",
  };
}
