import { describe, expect, it } from "vitest";
import { ALREADY_PAID_IN_FULL } from "@/lib/payments";
import { makePaymentRecord } from "@/lib/testing/fixtures";
import { createPaymentWriter, PAYMENT_CONFLICT, type PaymentStore } from "./paymentMutations";
import { paymentTargetKey, type PaymentRecord, type PaymentTarget } from "./payments";

// The ledger's write rules against an in-memory store: never Redis.
function memoryStore(initial: PaymentRecord[] = []) {
  let records = [...initial];
  let writes = 0;
  const store: PaymentStore = {
    read: async () => records,
    write: async (next) => {
      writes += 1;
      records = next;
    },
  };
  return { store, records: () => records, writes: () => writes };
}

const NOW = "2026-10-27T06:00:00.000Z";
const DEAL: PaymentTarget = { kind: "deal", campaignId: "MSP-MC0001" };
const OTHER: PaymentTarget = { kind: "deal", campaignId: "MSP-MC0002" };

function setup(initial: PaymentRecord[] = []) {
  const memory = memoryStore(initial);
  return { ...memory, writer: createPaymentWriter(memory.store, () => NOW) };
}

describe("insertPayments", () => {
  it("stamps and appends new records", async () => {
    const { writer, records } = setup();
    const [saved] = await writer.insertPayments([makePaymentRecord({ createdAt: "", updatedAt: "" })]);
    expect(saved).toMatchObject({ createdAt: NOW, updatedAt: NOW });
    expect(records()).toEqual([saved]);
  });

  it("answers the stored copy when the same payment is saved twice, and writes nothing", async () => {
    const existing = makePaymentRecord();
    const { writer, records, writes } = setup([existing]);
    const [saved] = await writer.insertPayments([{ ...existing, updatedAt: "later" }]);
    expect(saved).toBe(existing);
    expect(records()).toEqual([existing]);
    expect(writes()).toBe(0);
  });

  it("refuses the same id with different details", async () => {
    const existing = makePaymentRecord();
    const { writer, records } = setup([existing]);
    await expect(writer.insertPayments([{ ...existing, gross: 9999 }])).rejects.toThrow(PAYMENT_CONFLICT);
    expect(records()).toEqual([existing]);
  });

  it("re-checks what is owed against the list it is about to write", async () => {
    const { writer, records } = setup([makePaymentRecord({ id: "a", gross: 6000 })]);
    const owed = new Map([[paymentTargetKey(DEAL), 10000]]);
    await expect(writer.insertPayments([makePaymentRecord({ id: "b", gross: 5000 })], { owed })).rejects.toThrow(
      /^That is ₹ 1,000 more than the ₹ 4,000 still owed/
    );
    expect(records()).toHaveLength(1);
    await writer.insertPayments([makePaymentRecord({ id: "b", gross: 4000 })], { owed });
    await expect(writer.insertPayments([makePaymentRecord({ id: "c", gross: 1 })], { owed })).rejects.toThrow(
      ALREADY_PAID_IN_FULL
    );
  });

  it("checks only the targets it is told about", async () => {
    const { writer } = setup();
    const owed = new Map([[paymentTargetKey(OTHER), 1]]);
    await expect(writer.insertPayments([makePaymentRecord({ gross: 50000 })], { owed })).resolves.toHaveLength(1);
  });
});

describe("replacePayment, removePayment, removePaymentsWhere", () => {
  it("replaces in place, keeping the creation time", async () => {
    const existing = makePaymentRecord();
    const { writer, records } = setup([existing]);
    const change = await writer.replacePayment({ ...existing, note: "edited", createdAt: "x" });
    expect(change?.before).toBe(existing);
    expect(change?.after).toMatchObject({ note: "edited", createdAt: existing.createdAt, updatedAt: NOW });
    expect(records()).toEqual([change?.after]);
  });

  it("answers null for an id that is not there", async () => {
    const { writer, writes } = setup();
    expect(await writer.replacePayment(makePaymentRecord())).toBeNull();
    expect(await writer.removePayment("nope")).toBeNull();
    expect(await writer.removePaymentsWhere(() => true)).toEqual([]);
    expect(writes()).toBe(0);
  });

  it("removes one, or every match, and answers what it removed", async () => {
    const a = makePaymentRecord({ id: "a" });
    const b = makePaymentRecord({ id: "b", target: OTHER });
    const c = makePaymentRecord({ id: "c" });
    const { writer, records } = setup([a, b, c]);
    expect(await writer.removePayment("a")).toBe(a);
    expect(await writer.removePaymentsWhere((record) => record.target.kind === "deal" && record.target.campaignId === "MSP-MC0001")).toEqual([c]);
    expect(records()).toEqual([b]);
  });
});

describe("restorePayments", () => {
  it("adds only the ids that are missing and never overwrites one", async () => {
    const live = makePaymentRecord({ id: "a", note: "live" });
    const { writer, records } = setup([live]);
    const added = await writer.restorePayments([
      makePaymentRecord({ id: "a", note: "from trash" }),
      makePaymentRecord({ id: "b" }),
    ]);
    expect(added.map((record) => record.id)).toEqual(["b"]);
    expect(records().map((record) => [record.id, record.note])).toEqual([
      ["a", "live"],
      ["b", ""],
    ]);
  });

  it("writes nothing when everything is already there", async () => {
    const live = makePaymentRecord();
    const { writer, writes } = setup([live]);
    await writer.restorePayments([live]);
    await writer.restorePayments([]);
    expect(writes()).toBe(0);
  });
});

describe("retargetPayments", () => {
  it("moves every payment on one target to another", async () => {
    const invoice: PaymentTarget = { kind: "invoice", invoiceId: "inv" };
    const { writer, records } = setup([
      makePaymentRecord({ id: "a", target: invoice }),
      makePaymentRecord({ id: "b", target: OTHER }),
    ]);
    const moved = await writer.retargetPayments(invoice, DEAL);
    expect(moved.map((record) => record.id)).toEqual(["a"]);
    expect(records().map((record) => paymentTargetKey(record.target))).toEqual([
      "deal:MSP-MC0001",
      "deal:MSP-MC0002",
    ]);
    expect(records()[0].updatedAt).toBe(NOW);
  });
});
