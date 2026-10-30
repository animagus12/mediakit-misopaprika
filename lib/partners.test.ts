import { describe, expect, it } from "vitest";
import type { PartnerTransferInput, PartnerTransferRecord } from "@/repositories/partnerTransfers";
import type { OutflowRow } from "./expenses";
import { debtLabel, partnerCosts, settleUpLabel, summarizePartners, validateSettleUp, type PartnerCost } from "./partners";

const TODAY = "2026-10-28";

function outflow(overrides: Partial<OutflowRow> = {}): OutflowRow {
  return {
    id: "e1",
    source: "expense",
    date: "2026-10-12",
    estimated: false,
    fy: 2026,
    amount: 500,
    category: "props",
    description: "Props",
    editor: null,
    campaignId: null,
    dealLabel: null,
    paidBy: "subhrajit",
    settlement: null,
    method: null,
    receiptUrl: null,
    note: "",
    ...overrides,
  };
}

function cost(overrides: Partial<PartnerCost> = {}): PartnerCost {
  return { source: "expense", id: "c1", date: "2026-10-12", amount: 500, description: "Props", detail: "", paidBy: "subhrajit", settlement: null, ...overrides };
}

function settleUp(overrides: Partial<PartnerTransferRecord> = {}): PartnerTransferRecord {
  return {
    id: "t1",
    date: "2026-10-20",
    from: "ritika",
    to: "subhrajit",
    amount: 250,
    note: "",
    createdAt: "2026-10-20T10:00:00.000Z",
    updatedAt: "2026-10-20T10:00:00.000Z",
    ...overrides,
  };
}

describe("partnerCosts", () => {
  it("keeps only what a partner paid personally, newest first, with what it was for", () => {
    const costs = partnerCosts([
      outflow({ id: "old", date: "2026-09-01" }),
      outflow({ id: "biz", paidBy: "business" }),
      outflow({ id: "unknown", paidBy: null }),
      outflow({ id: "edit", source: "editing", category: "editing", paidBy: "ritika", editor: "Divyanshu", dealLabel: "Blinkit · Rakhi", settlement: "split" }),
    ]);
    expect(costs.map((entry) => [entry.id, entry.paidBy, entry.detail, entry.settlement])).toEqual([
      ["edit", "ritika", "Divyanshu · Blinkit · Rakhi", "split"],
      ["old", "subhrajit", "", null],
    ]);
  });
});

describe("summarizePartners", () => {
  it("repaid from business funds: the business owes the partner all of it", () => {
    expect(summarizePartners([cost({ settlement: "business" })], []).debts).toEqual([
      { from: "business", to: "subhrajit", amount: 500 },
    ]);
  });

  it("split 50/50: the other partner owes half", () => {
    expect(summarizePartners([cost({ settlement: "split" })], []).debts).toEqual([
      { from: "ritika", to: "subhrajit", amount: 250 },
    ]);
  });

  it("nets what the partners owe each other into one figure", () => {
    const summary = summarizePartners(
      [cost({ settlement: "split", amount: 500 }), cost({ id: "c2", paidBy: "ritika", settlement: "split", amount: 300 })],
      []
    );
    expect(summary.debts).toEqual([{ from: "ritika", to: "subhrajit", amount: 100 }]);
    expect(summary.paid).toEqual([
      { partner: "subhrajit", amount: 500 },
      { partner: "ritika", amount: 300 },
    ]);
  });

  it("is square once settled up, and turns round when someone pays too much", () => {
    const costs = [cost({ settlement: "split" }), cost({ id: "c2", settlement: "business", amount: 1200 })];
    expect(summarizePartners(costs, [settleUp(), settleUp({ id: "t2", from: "business", amount: 1200 })]).debts).toEqual([]);
    expect(summarizePartners(costs, [settleUp({ amount: 400 })]).debts).toEqual([
      { from: "business", to: "subhrajit", amount: 1200 },
      { from: "subhrajit", to: "ritika", amount: 150 },
    ]);
  });

  it("lists what is still to settle, and leaves it out of the balances", () => {
    const summary = summarizePartners([cost(), cost({ id: "c2", settlement: "business" })], []);
    expect(summary.toSettle.map((entry) => entry.id)).toEqual(["c1"]);
    expect(summary.debts).toEqual([{ from: "business", to: "subhrajit", amount: 500 }]);
  });

  it("splits paise down to the paisa", () => {
    expect(summarizePartners([cost({ settlement: "split", amount: 333.33 })], []).debts[0].amount).toBe(166.67);
  });
});

describe("labels", () => {
  it("names a balance and a settle-up the way they read on the page", () => {
    expect(debtLabel({ from: "business", to: "ritika" })).toBe("Business funds owe Ritika");
    expect(debtLabel({ from: "ritika", to: "subhrajit" })).toBe("Ritika owes Subhrajit");
    expect(settleUpLabel({ from: "business", to: "subhrajit" })).toBe("Business funds paid Subhrajit");
  });
});

describe("validateSettleUp", () => {
  const input: PartnerTransferInput = {
    id: "6f1c2b3a-1111-4aaa-8bbb-000000000001",
    date: "2026-10-20",
    from: "ritika",
    to: "subhrajit",
    amount: 250,
    note: "",
  };

  it("accepts a settle-up between two different people", () => {
    expect(validateSettleUp(input, TODAY)).toBeNull();
  });

  it("refuses a bad id, a future day, the same person twice and a bad amount", () => {
    expect(validateSettleUp({ ...input, id: "x" }, TODAY)).toMatch(/id isn't valid/);
    expect(validateSettleUp({ ...input, date: "2026-10-29" }, TODAY)).toBe("A settle-up can't be dated in the future");
    expect(validateSettleUp({ ...input, to: "ritika" }, TODAY)).toBe("Choose two different people");
    expect(validateSettleUp({ ...input, amount: 0 }, TODAY)).toBe("Enter the amount, up to two decimals");
    expect(validateSettleUp({ ...input, amount: 1.005 }, TODAY)).toBe("Enter the amount, up to two decimals");
  });
});
