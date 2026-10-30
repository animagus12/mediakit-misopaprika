// Every change the payment ledger can make to its stored list, as a
// read-modify-write over an injected store.
//
// Kept apart from ./payments.writer.server, which binds it to Redis, so the
// rules (idempotent inserts, the overpay re-check, restore adding only what
// is missing) are tested against an in-memory store and never against the
// live one. No "server-only" for the same reason; nothing on the client
// imports it.
//
// Every change goes through one `mutate`: read, apply, write. That is the
// single place a compare-and-set would go if two writes ever truly overlap;
// until then the last write wins, as it does for every other collection.

import type { RecordChange } from "@/lib/activityDiff";
import { roundMoney, sumMoney } from "@/lib/money";
import { ALREADY_PAID_IN_FULL, overpayMessage } from "@/lib/payments";
import { paymentTargetKey, samePaymentTarget, type PaymentRecord, type PaymentTarget } from "./payments";

export interface PaymentStore {
  read(): Promise<PaymentRecord[]>;
  write(records: PaymentRecord[]): Promise<void>;
}

export interface InsertPaymentsOptions {
  /**
   * What each target is owed, keyed by paymentTargetKey. A target named here
   * is re-checked against the list as it is about to be written, so a second
   * tab or a double tap that slipped past the form cannot overpay it.
   */
  owed?: ReadonlyMap<string, number>;
}

export interface PaymentWriter {
  /** Idempotent per id: the same payment saved twice answers the first copy. */
  insertPayments(records: PaymentRecord[], options?: InsertPaymentsOptions): Promise<PaymentRecord[]>;
  replacePayment(record: PaymentRecord): Promise<RecordChange<PaymentRecord> | null>;
  removePayment(id: string): Promise<PaymentRecord | null>;
  removePaymentsWhere(match: (record: PaymentRecord) => boolean): Promise<PaymentRecord[]>;
  /** Adds the records whose ids are missing and leaves every other one alone. */
  restorePayments(records: PaymentRecord[]): Promise<PaymentRecord[]>;
  retargetPayments(from: PaymentTarget, to: PaymentTarget): Promise<PaymentRecord[]>;
}

export const PAYMENT_CONFLICT = "This payment was already saved with different details";

/** Same payment, whenever it was saved: every field but the timestamps. */
export function samePaymentDetails(a: PaymentRecord, b: PaymentRecord): boolean {
  return (
    a.id === b.id &&
    samePaymentTarget(a.target, b.target) &&
    a.date === b.date &&
    a.gross === b.gross &&
    a.tds === b.tds &&
    a.bankFee === b.bankFee &&
    a.receivedInto === b.receivedInto &&
    a.method === b.method &&
    a.reference === b.reference &&
    a.note === b.note &&
    a.origin === b.origin
  );
}

function settledFor(records: PaymentRecord[], key: string): number {
  return sumMoney(records.filter((record) => paymentTargetKey(record.target) === key).map((record) => record.gross));
}

function assertNotOverpaid(
  before: PaymentRecord[],
  after: PaymentRecord[],
  added: PaymentRecord[],
  owed: ReadonlyMap<string, number>
): void {
  const keys = new Set(added.map((record) => paymentTargetKey(record.target)));
  for (const key of keys) {
    const limit = owed.get(key);
    if (limit === undefined) continue;
    const excess = roundMoney(settledFor(after, key) - limit);
    if (excess <= 0) continue;
    const remaining = Math.max(0, roundMoney(limit - settledFor(before, key)));
    throw new Error(remaining <= 0 ? ALREADY_PAID_IN_FULL : overpayMessage(excess, remaining));
  }
}

export function createPaymentWriter(
  store: PaymentStore,
  now: () => string = () => new Date().toISOString()
): PaymentWriter {
  async function mutate<R>(fn: (records: PaymentRecord[]) => { next: PaymentRecord[] | null; result: R }): Promise<R> {
    const records = await store.read();
    const { next, result } = fn(records);
    if (next) await store.write(next);
    return result;
  }

  return {
    insertPayments(incoming, options = {}) {
      if (incoming.length === 0) return Promise.resolve([]);
      return mutate((records) => {
        const byId = new Map(records.map((record) => [record.id, record]));
        const stamp = now();
        const added: PaymentRecord[] = [];
        const result = incoming.map((record) => {
          const existing = byId.get(record.id);
          if (existing) {
            if (!samePaymentDetails(existing, record)) throw new Error(PAYMENT_CONFLICT);
            return existing;
          }
          const created: PaymentRecord = { ...record, createdAt: record.createdAt || stamp, updatedAt: stamp };
          byId.set(created.id, created);
          added.push(created);
          return created;
        });
        if (added.length === 0) return { next: null, result };
        const next = [...records, ...added];
        if (options.owed) assertNotOverpaid(records, next, added, options.owed);
        return { next, result };
      });
    },

    replacePayment(record) {
      return mutate((records) => {
        const before = records.find((entry) => entry.id === record.id);
        if (!before) return { next: null, result: null };
        const after: PaymentRecord = { ...record, createdAt: before.createdAt, updatedAt: now() };
        return {
          next: records.map((entry) => (entry.id === record.id ? after : entry)),
          result: { before, after },
        };
      });
    },

    removePayment(id) {
      return mutate((records) => {
        const removed = records.find((entry) => entry.id === id) ?? null;
        if (!removed) return { next: null, result: null };
        return { next: records.filter((entry) => entry.id !== id), result: removed };
      });
    },

    removePaymentsWhere(match) {
      return mutate((records) => {
        const removed = records.filter(match);
        if (removed.length === 0) return { next: null, result: [] };
        const ids = new Set(removed.map((record) => record.id));
        return { next: records.filter((record) => !ids.has(record.id)), result: removed };
      });
    },

    restorePayments(incoming) {
      if (incoming.length === 0) return Promise.resolve([]);
      return mutate((records) => {
        const ids = new Set(records.map((record) => record.id));
        const added: PaymentRecord[] = [];
        for (const record of incoming) {
          if (ids.has(record.id)) continue;
          ids.add(record.id);
          added.push(record);
        }
        return { next: added.length > 0 ? [...records, ...added] : null, result: added };
      });
    },

    retargetPayments(from, to) {
      return mutate((records) => {
        const stamp = now();
        const moved: PaymentRecord[] = [];
        const next = records.map((record) => {
          if (!samePaymentTarget(record.target, from)) return record;
          const retargeted: PaymentRecord = { ...record, target: to, updatedAt: stamp };
          moved.push(retargeted);
          return retargeted;
        });
        return { next: moved.length > 0 ? next : null, result: moved };
      });
    },
  };
}
