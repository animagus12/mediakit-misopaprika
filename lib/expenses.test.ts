import { describe, expect, it } from "vitest";
import { makeCampaign, makeEditorTransaction, makeInvoiceRecord, makeRenewal, makeUsage } from "@/lib/testing/fixtures";
import { toExpenseRecord, type ExpenseInput, type ExpenseRecord } from "@/repositories/expenses";
import {
  DELETED_DEAL_LABEL,
  attachDealCosts,
  buildExpenseDealOptions,
  dealCashAfterCosts,
  expenseCostByMonth,
  lastExpenseDefaults,
  outflowRows,
  summarizeOutflows,
  validateExpense,
  validateNewExpenseId,
} from "./expenses";

const TODAY = "2026-10-28";

function expense(overrides: Partial<ExpenseRecord> = {}): ExpenseRecord {
  return {
    id: "6f1c2b3a-1111-4aaa-8bbb-000000000001",
    date: "2026-10-05",
    amount: 1200,
    category: "props",
    description: "Spider-Man figure",
    paidBy: "ritika",
    settlement: null,
    method: "UPI",
    campaignId: null,
    receiptUrl: null,
    note: "",
    createdAt: "2026-10-05T10:00:00.000Z",
    updatedAt: "2026-10-05T10:00:00.000Z",
    ...overrides,
  };
}

function input(overrides: Partial<ExpenseInput> = {}): ExpenseInput {
  const record = expense();
  return {
    id: record.id,
    date: record.date,
    amount: record.amount,
    category: record.category,
    description: record.description,
    paidBy: "ritika",
    settlement: record.settlement,
    method: record.method,
    campaignId: record.campaignId,
    receiptUrl: record.receiptUrl,
    note: record.note,
    ...overrides,
  };
}

describe("validateExpense", () => {
  it("accepts a complete expense", () => {
    expect(validateExpense(input(), TODAY)).toBeNull();
  });

  it("refuses, in order: a bad date, a future one, a bad amount, no description, no payer", () => {
    expect(validateExpense(input({ date: "05/10/2026" }), TODAY)).toBe("Pick the day the money went out");
    expect(validateExpense(input({ date: "2026-10-29" }), TODAY)).toBe("An expense can't be dated in the future");
    expect(validateExpense(input({ amount: 0 }), TODAY)).toBe("Enter the amount spent, up to two decimals");
    expect(validateExpense(input({ amount: 10.005 }), TODAY)).toBe("Enter the amount spent, up to two decimals");
    expect(validateExpense(input({ description: "  " }), TODAY)).toBe("Say what it was");
    expect(validateExpense(input({ paidBy: "someone" as never }), TODAY)).toBe("Choose whose account it came out of");
  });

  it("refuses a receipt that isn't an https upload, and a blank deal id", () => {
    expect(validateExpense(input({ receiptUrl: "javascript:alert(1)" }), TODAY)).toBe(
      "That receipt didn't upload properly. Upload it again."
    );
    expect(validateExpense(input({ campaignId: " " }), TODAY)).toBe("Pick the deal it was for, or no deal");
  });

  it("only takes a UUID for a new expense's id", () => {
    expect(validateNewExpenseId(expense().id)).toBeNull();
    expect(validateNewExpenseId("abc")).not.toBeNull();
  });
});

describe("partner settlement", () => {
  it("is kept only on a cost a partner paid, and only as one of the two ways", () => {
    expect(toExpenseRecord({ ...expense(), paidBy: "ritika", settlement: "split" })?.settlement).toBe("split");
    expect(toExpenseRecord({ ...expense(), paidBy: "business", settlement: "split" })?.settlement).toBeNull();
    expect(toExpenseRecord({ ...expense(), paidBy: "ritika", settlement: "later" })?.settlement).toBeNull();
    expect(validateExpense(input({ settlement: "later" as never }), TODAY)).toBe("Choose how it is settled");
  });

  it("reaches money out from the editor workspace too", () => {
    const rows = outflowRows(
      [],
      [
        makeEditorTransaction({ id: "by-ritika", paidBy: "ritika", settlement: "business", paidDate: "01/10/2026" }),
        makeEditorTransaction({ id: "by-business", paidBy: "business", settlement: "split", paidDate: "01/10/2026" }),
      ],
      [],
      []
    );
    expect(rows.map((row) => [row.id, row.settlement])).toEqual([
      ["by-ritika", "business"],
      ["by-business", null],
    ]);
  });
});

describe("toExpenseRecord", () => {
  it("coerces what storage hands back and drops a row that can't be an expense", () => {
    expect(toExpenseRecord({ ...expense(), category: "snacks", receiptUrl: "http://x", paidBy: "Ritika" })).toMatchObject({
      category: "other",
      receiptUrl: null,
      paidBy: "ritika",
    });
    expect(toExpenseRecord({ ...expense(), amount: 0 })).toBeNull();
    expect(toExpenseRecord({ ...expense(), id: "" })).toBeNull();
    expect(toExpenseRecord({ ...expense(), date: "05/10/2026" })?.date).toBe("2026-10-05");
  });
});

describe("attachDealCosts", () => {
  const job = makeEditorTransaction({ id: "ET-deal", amount: 500, status: "Pending", editor: "Divyanshu" });
  const invoiceJob = makeEditorTransaction({ id: "ET-invoice", amount: 300 });
  const cancelled = makeEditorTransaction({ id: "ET-cancelled", status: "Cancelled" });

  it("costs a deal with its editing job and its expenses, and nothing it doesn't own", () => {
    const [deal, other] = attachDealCosts(
      [makeCampaign({ id: "D1", editorTransactionId: "ET-deal" }), makeCampaign({ id: "D2" })],
      [],
      [expense({ campaignId: "D1" }), expense({ id: "e2", campaignId: "D1", amount: 300, date: "2026-10-09" }), expense({ id: "e3" })],
      [job]
    );
    expect(deal.costs).toMatchObject({
      editing: { transactionId: "ET-deal", amount: 500, paid: false, editor: "Divyanshu" },
      total: 2000,
    });
    expect(deal.costs?.expenses.map((entry) => entry.id)).toEqual(["e2", expense().id]);
    expect(other.costs).toEqual({ editing: null, expenses: [], total: 0 });
  });

  it("falls back to the job the deal's invoice bills against, and skips a cancelled one", () => {
    const [viaInvoice, viaCancelled] = attachDealCosts(
      [makeCampaign({ id: "D1", invoiceId: "inv" }), makeCampaign({ id: "D2", editorTransactionId: "ET-cancelled" })],
      [makeInvoiceRecord({ id: "inv", editorTransactionId: "ET-invoice" })],
      [],
      [invoiceJob, cancelled]
    );
    expect(viaInvoice.costs?.editing).toMatchObject({ transactionId: "ET-invoice", amount: 300, paid: true });
    expect(viaCancelled.costs?.editing).toBeNull();
  });

  it("costs one job to one deal, so two deals pointing at it don't count it twice", () => {
    const [first, second] = attachDealCosts(
      [makeCampaign({ id: "D1", editorTransactionId: "ET-deal" }), makeCampaign({ id: "D2", editorTransactionId: "ET-deal" })],
      [],
      [],
      [job]
    );
    expect(first.costs?.editing?.transactionId).toBe("ET-deal");
    expect(second.costs?.editing).toBeNull();
  });

  it("says what the deal kept: its cash and renewals, less every cost", () => {
    const [deal] = attachDealCosts(
      [
        makeCampaign({
          id: "D1",
          amount: 10000,
          editorTransactionId: "ET-deal",
          usage: makeUsage({ days: 30, renewals: [makeRenewal({ amount: 3000 })] }),
        }),
      ],
      [],
      [expense({ campaignId: "D1" })],
      [job]
    );
    expect(dealCashAfterCosts(deal)).toEqual({ cash: 13000, costs: 1700, kept: 11300 });
    expect(dealCashAfterCosts(makeCampaign())).toBeNull();
  });
});

describe("outflowRows", () => {
  const campaigns = [makeCampaign({ id: "D1", brand: "Blinkit", campaign: "Rakhi", editorTransactionId: "ET-paid" })];
  const transactions = [
    makeEditorTransaction({ id: "ET-paid", amount: 400, paidDate: "20/10/2026", paidBy: "business", paymentMethod: "upi" }),
    makeEditorTransaction({ id: "ET-old", amount: 250, paidDate: "", deliveryDate: "12/04/2026", video: "Old cut" }),
    makeEditorTransaction({ id: "ET-pending", status: "Pending" }),
  ];
  const rows = outflowRows(
    [expense({ campaignId: "D1" }), expense({ id: "e-gone", campaignId: "D9", date: "2026-09-01", category: "travel" })],
    transactions,
    campaigns,
    []
  );

  it("lists expenses and paid editor jobs only, newest first, read from where they live", () => {
    expect(rows.map((row) => [row.source, row.id, row.date])).toEqual([
      ["editing", "ET-paid", "2026-10-20"],
      ["expense", expense().id, "2026-10-05"],
      ["expense", "e-gone", "2026-09-01"],
      ["editing", "ET-old", "2026-04-12"],
    ]);
  });

  it("names each row's deal as it is now, and a deleted one as gone", () => {
    const byId = new Map(rows.map((row) => [row.id, row]));
    expect(byId.get("ET-paid")).toMatchObject({ dealLabel: "Blinkit · Rakhi", paidBy: "business", method: "UPI", fy: 2026 });
    expect(byId.get(expense().id)?.dealLabel).toBe("Blinkit · Rakhi");
    expect(byId.get("e-gone")?.dealLabel).toBe(DELETED_DEAL_LABEL);
  });

  it("files an editor payment with no paid date by its delivery date, flagged as estimated", () => {
    expect(rows.find((row) => row.id === "ET-old")).toMatchObject({ estimated: true, fy: 2026 });
  });

  it("adds up by category and by whose account it came out of", () => {
    expect(summarizeOutflows(rows)).toEqual({
      total: 3050,
      editing: 650,
      expenses: 2400,
      estimated: 250,
      byCategory: [
        { category: "props", amount: 1200 },
        { category: "travel", amount: 1200 },
        { category: "editing", amount: 650 },
      ],
      byPayer: [
        { payer: "ritika", amount: 2400 },
        { payer: "business", amount: 400 },
        { payer: null, amount: 250 },
      ],
    });
  });
});

describe("helpers", () => {
  it("adds expenses up by the month they were paid", () => {
    expect(
      expenseCostByMonth([
        { date: "2026-10-05", amount: 0.1 },
        { date: "2026-10-30", amount: 0.2 },
        { date: "2026-09-01", amount: 5 },
      ])
    ).toEqual(new Map([["2026-10", 0.3], ["2026-09", 5]]));
  });

  it("starts a new expense on the account and method last used", () => {
    expect(
      lastExpenseDefaults([
        expense({ createdAt: "2026-10-01T00:00:00Z", paidBy: "subhrajit", method: "Cash" }),
        expense({ createdAt: "2026-10-02T00:00:00Z", paidBy: "ritika", method: "Card" }),
      ])
    ).toEqual({ paidBy: "ritika", method: "Card" });
    expect(lastExpenseDefaults([])).toEqual({ paidBy: "business", method: null });
  });

  it("offers every deal, newest first", () => {
    expect(
      buildExpenseDealOptions([
        makeCampaign({ id: "old", date: "01/01/2026", campaign: "Old" }),
        makeCampaign({ id: "new", date: "01/09/2026", campaign: "New", status: "Cancelled" }),
      ]).map((option) => option.id)
    ).toEqual(["new", "old"]);
  });
});
