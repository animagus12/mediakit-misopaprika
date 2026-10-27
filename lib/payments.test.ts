import { describe, expect, it } from "vitest";
import campaignsSeed from "@/data/campaigns.json";
import { financialYearStart } from "@/lib/financialYear";
import { roundMoney } from "@/lib/money";
import {
  ledgerCampaigns,
  makeCampaignRecord,
  makeInvoiceRecord,
  makePaymentRecord,
  makeRenewal,
  makeUsage,
} from "@/lib/testing/fixtures";
import { toCampaign, type Campaign, type CampaignRecord } from "@/repositories/campaigns";
import { toInvoice, type InvoiceRecord } from "@/repositories/invoices";
import {
  paymentNet,
  settle,
  toLedgerEntry,
  toPaymentRecord,
  type PaymentInput,
  type PaymentRecord,
  type PaymentTarget,
} from "@/repositories/payments";
import {
  ALREADY_PAID_IN_FULL,
  attachInvoiceSettlements,
  barterState,
  findOrphanPayments,
  invoiceDisplayStatus,
  ledgerWarnings,
  settlementLabel,
  suggestPayment,
  validateNewPaymentId,
  validatePayment,
  type PaymentValidationContext,
} from "./payments";

const DEAL: PaymentTarget = { kind: "deal", campaignId: "MSP-MC0001" };

function onlyDeal(records: CampaignRecord[], invoices: InvoiceRecord[] = [], payments: PaymentRecord[] = []): Campaign {
  return ledgerCampaigns(records, invoices, payments)[0];
}

function entry(overrides: Partial<PaymentRecord>) {
  return toLedgerEntry(makePaymentRecord(overrides), "");
}

describe("virtual legacy entries", () => {
  it("reads a received deal with no paid date as one undated entry filed on its upload date", () => {
    const deal = onlyDeal([makeCampaignRecord({ amount: 25000, uploadDate: "14/08/2026", tdsRate: 10 })]);
    expect(deal.settlement?.entries).toHaveLength(1);
    expect(deal.settlement?.entries[0]).toMatchObject({
      id: "legacy:status:deal:MSP-MC0001",
      source: "virtual",
      legacyKind: "status",
      date: "",
      bucketDate: "2026-08-14",
      gross: 25000,
      tds: 2500,
      net: 22500,
      tdsEstimated: true,
      receivedInto: null,
    });
    expect(deal.settlement).toMatchObject({ status: "paid", paidOn: "", lastPaidOn: "", hasStored: false });
  });

  it("falls back to the deal date when there is no upload date", () => {
    const deal = onlyDeal([makeCampaignRecord({ date: "03/05/2026", uploadDate: "" })]);
    expect(deal.settlement?.entries[0].bucketDate).toBe("2026-05-03");
  });

  it("dates the entry by the stored paid date and reads its method", () => {
    const deal = onlyDeal([makeCampaignRecord({ paidDate: "02/09/2026", paymentMethod: "upi" })]);
    expect(deal.settlement?.entries[0]).toMatchObject({ date: "2026-09-02", bucketDate: "2026-09-02", method: "UPI" });
    expect(deal.settlement).toMatchObject({ paidOn: "2026-09-02", lastPaidOn: "2026-09-02", method: "UPI" });
  });

  it("reads a received renewal as one entry filed on its start date", () => {
    const deal = onlyDeal([
      makeCampaignRecord({
        usage: makeUsage({ renewals: [makeRenewal({ amount: 3000, startDate: "01/06/2026", tdsAmount: 300 })] }),
      }),
    ]);
    const renewal = deal.usage.renewals[0];
    expect(renewal.settlement.entries[0]).toMatchObject({
      id: "legacy:status:renewal:MSP-MC0001:R0001",
      bucketDate: "2026-06-01",
      gross: 3000,
      tds: 300,
      tdsEstimated: false,
    });
    expect(renewal.settlement.status).toBe("paid");
    expect(renewal.storedPaymentStatus).toBe("received");
  });

  it("reads a linked invoice's advance on a pending deal as a partial payment, leaving its status alone", () => {
    const deal = onlyDeal(
      [makeCampaignRecord({ amount: 60000, paymentStatus: "pending", invoiceRef: "MSP-INV-0009", invoiceId: "inv" })],
      [makeInvoiceRecord({ id: "inv", advance: 20000, issueDate: "2026-09-01" })]
    );
    expect(deal.settlement?.entries).toEqual([
      expect.objectContaining({ id: "legacy:advance:deal:MSP-MC0001", gross: 20000, tds: 0, date: "", bucketDate: "2026-09-01" }),
    ]);
    expect(deal.settlement).toMatchObject({ status: "partial", settled: 20000, remaining: 40000 });
    expect(deal.paymentStatus).toBe("pending");
  });

  it("caps an advance at what the deal is owed", () => {
    const deal = onlyDeal(
      [makeCampaignRecord({ amount: 60000, paymentStatus: "pending", invoiceRef: "X", invoiceId: "inv" })],
      [makeInvoiceRecord({ id: "inv", advance: 70000 })]
    );
    expect(deal.settlement?.entries[0].gross).toBe(60000);
  });

  it("never stacks an advance on a received deal", () => {
    const deal = onlyDeal(
      [makeCampaignRecord({ amount: 60000, paymentStatus: "received", invoiceRef: "X", invoiceId: "inv" })],
      [makeInvoiceRecord({ id: "inv", advance: 20000 })]
    );
    expect(deal.settlement?.entries.map((e) => e.legacyKind)).toEqual(["status"]);
    expect(deal.settlement?.settled).toBe(60000);
  });

  it("ignores a void invoice's advance", () => {
    const deal = onlyDeal(
      [makeCampaignRecord({ paymentStatus: "pending", invoiceRef: "X", invoiceId: "inv" })],
      [makeInvoiceRecord({ id: "inv", advance: 2000, status: "void" })]
    );
    expect(deal.settlement?.entries).toEqual([]);
  });

  it("gives barter-only and scam deals no cash settlement at all", () => {
    const [barter, scam] = ledgerCampaigns([
      makeCampaignRecord({ id: "B", type: "Barter", amount: 0, barterValue: 5000 }),
      makeCampaignRecord({ id: "S", type: "Scam", amount: 4000 }),
    ]);
    expect(barter.settlement).toBeNull();
    expect(scam.settlement).toBeNull();
  });

  it("ignores a linked invoice marked paid while its deal is pending", () => {
    const deal = onlyDeal(
      [makeCampaignRecord({ paymentStatus: "pending", invoiceRef: "X", invoiceId: "inv" })],
      [makeInvoiceRecord({ id: "inv", status: "paid" })]
    );
    expect(deal.settlement).toMatchObject({ status: "pending", entries: [] });
  });

  it("keeps the entry on a called-off deal, whose reports leave it out themselves", () => {
    const deal = onlyDeal([makeCampaignRecord({ status: "Cancelled", paidDate: "01/06/2026", tdsAmount: 1500 })]);
    expect(deal.settlement?.entries).toHaveLength(1);
  });

  it("uses an entered TDS amount over the rate, and marks a rate estimate", () => {
    const [entered, estimated] = ledgerCampaigns([
      makeCampaignRecord({ id: "A", amount: 20000, tdsRate: 10, tdsAmount: 1800 }),
      makeCampaignRecord({ id: "B", amount: 20000, tdsRate: 10 }),
    ]);
    expect(entered.settlement?.entries[0]).toMatchObject({ tds: 1800, tdsEstimated: false });
    expect(estimated.settlement?.entries[0]).toMatchObject({ tds: 2000, tdsEstimated: true });
  });
});

describe("stored entries", () => {
  it("hide every virtual entry and take over the projected fields", () => {
    const deal = onlyDeal(
      [makeCampaignRecord({ amount: 50000, paymentStatus: "received", paidDate: "01/05/2026", tdsRate: 10, invoiceRef: "X", invoiceId: "inv" })],
      [makeInvoiceRecord({ id: "inv", advance: 20000 })],
      [makePaymentRecord({ gross: 5000, date: "2026-06-01" })]
    );
    expect(deal.settlement?.entries.map((e) => e.source)).toEqual(["stored"]);
    expect(deal.settlement).toMatchObject({ status: "partial", settled: 5000, hasStored: true });
    expect(deal).toMatchObject({
      paymentStatus: "pending",
      storedPaymentStatus: "received",
      paidDate: "",
      paymentMethod: "UPI",
      tdsAmount: 0,
    });
  });

  it("file an undated stored entry on the target's fallback day", () => {
    const deal = onlyDeal(
      [makeCampaignRecord({ uploadDate: "14/08/2026" })],
      [],
      [makePaymentRecord({ date: "", origin: "legacy" })]
    );
    expect(deal.settlement?.entries[0].bucketDate).toBe("2026-08-14");
  });
});

describe("settle", () => {
  it("is unknown or pending with nothing received, by what was stored", () => {
    expect(settle(DEAL, 1000, [], "unknown").status).toBe("unknown");
    expect(settle(DEAL, 1000, [], "pending").status).toBe("pending");
    expect(settle(DEAL, 1000, [], "received").status).toBe("pending");
    expect(settle(DEAL, 0, [], "pending").status).toBe("unknown");
  });

  it("is partial, paid, or paid with an overpayment", () => {
    expect(settle(DEAL, 1000, [entry({ gross: 400 })], "pending")).toMatchObject({
      status: "partial",
      remaining: 600,
      overpaid: 0,
    });
    expect(settle(DEAL, 1000, [entry({ gross: 1000 })], "pending").status).toBe("paid");
    expect(settle(DEAL, 1000, [entry({ gross: 1200 })], "pending")).toMatchObject({
      status: "paid",
      remaining: 0,
      overpaid: 200,
    });
  });

  it("dates the payment by the entry that completed it, not the last one", () => {
    const settlement = settle(
      DEAL,
      45000,
      [
        entry({ id: "b", gross: 30000, date: "2027-04-10" }),
        entry({ id: "a", gross: 20000, date: "2026-11-05" }),
        entry({ id: "c", gross: 100, date: "2027-05-01" }),
      ],
      "pending"
    );
    expect(settlement.entries.map((e) => e.id)).toEqual(["a", "b", "c"]);
    expect(settlement).toMatchObject({ paidOn: "2027-04-10", lastPaidOn: "2027-05-01" });
  });

  it("has no paid-on day when the completing entry is undated", () => {
    expect(settle(DEAL, 1000, [entry({ gross: 1000, date: "" })], "pending").paidOn).toBe("");
  });

  it("names the method, or Multiple when payments used different ones", () => {
    expect(settle(DEAL, 1000, [entry({ gross: 500, method: "UPI" }), entry({ id: "2", gross: 500, method: null })], "pending").method).toBe("UPI");
    expect(
      settle(DEAL, 1000, [entry({ gross: 500, method: "UPI" }), entry({ id: "2", gross: 500, method: "Cash" })], "pending").method
    ).toBe("Multiple");
    expect(settle(DEAL, 1000, [], "pending").method).toBe("");
  });

  it("rounds once: 0.1, 0.2 and 0 settle 0.3", () => {
    const settlement = settle(
      DEAL,
      0.3,
      [entry({ gross: 0.1 }), entry({ id: "2", gross: 0.2 }), entry({ id: "3", gross: 0 })],
      "pending"
    );
    expect(settlement).toMatchObject({ settled: 0.3, status: "paid", remaining: 0 });
  });
});

describe("identity projection", () => {
  it("leaves every seed deal's payment fields exactly as stored", () => {
    const records = campaignsSeed as CampaignRecord[];
    const joined = ledgerCampaigns(records);
    joined.forEach((deal, index) => {
      const stored = toCampaign(records[index]);
      expect({
        paymentStatus: deal.paymentStatus,
        paidDate: deal.paidDate,
        paymentMethod: deal.paymentMethod,
        tdsAmount: deal.tdsAmount,
      }).toEqual({
        paymentStatus: stored.paymentStatus,
        paidDate: stored.paidDate,
        paymentMethod: stored.paymentMethod,
        tdsAmount: stored.tdsAmount,
      });
      expect(deal.storedPaymentStatus).toBe(records[index].paymentStatus);
    });
  });

  it("leaves renewal payment fields exactly as stored", () => {
    const renewals = [
      makeRenewal({ id: "R0001", paymentStatus: "received", paidDate: "15/08/2026", paymentMethod: "UPI", tdsAmount: 50 }),
      makeRenewal({ id: "R0002", paymentStatus: "pending", invoiceId: "inv" }),
      makeRenewal({ id: "R0003", paymentStatus: "unknown", amount: 0 }),
    ];
    const deal = onlyDeal(
      [makeCampaignRecord({ usage: makeUsage({ renewals }) })],
      [makeInvoiceRecord({ id: "inv", advance: 500 })]
    );
    deal.usage.renewals.forEach((renewal, index) => {
      expect(renewal).toMatchObject({
        paymentStatus: renewals[index].paymentStatus,
        paidDate: renewals[index].paidDate,
        paymentMethod: renewals[index].paymentMethod,
        tdsAmount: renewals[index].tdsAmount,
      });
    });
    expect(deal.usage.renewals[1].settlement).toMatchObject({ status: "partial", settled: 500 });
  });
});

describe("barterState", () => {
  const paid = settle(DEAL, 1000, [entry({ gross: 1000 })], "pending");
  const pending = settle(DEAL, 1000, [], "pending");

  it("is null on a deal with no barter half", () => {
    expect(barterState("Paid", "received", undefined, paid)).toBeNull();
  });
  it("is the stored status on a barter-only deal", () => {
    expect(barterState("Barter", "pending", undefined, null)).toBe("pending");
  });
  it("is the explicit barter status when one was recorded", () => {
    expect(barterState("Barter+Paid", "received", "pending", paid)).toBe("pending");
  });
  it("reads received when the deal was stored received or its cash is paid", () => {
    expect(barterState("Barter+Paid", "received", undefined, pending)).toBe("received");
    expect(barterState("Barter+Paid", "pending", undefined, paid)).toBe("received");
  });
  it("is the stored status otherwise", () => {
    expect(barterState("Barter+Paid", "unknown", undefined, pending)).toBe("unknown");
  });
});

describe("invoices", () => {
  function joined(invoices: InvoiceRecord[], records: CampaignRecord[] = [], payments: PaymentRecord[] = [], project = true) {
    const campaigns = ledgerCampaigns(records, invoices, payments);
    return attachInvoiceSettlements(invoices.map(toInvoice), campaigns, payments, project);
  }

  it("owes nothing once paid", () => {
    const [invoice] = joined([makeInvoiceRecord({ status: "paid" })]);
    expect(invoice).toMatchObject({ status: "paid", balanceDue: 0, owner: null });
  });

  it("owes the subtotal less what was received while partial", () => {
    const [invoice] = joined([makeInvoiceRecord({ id: "inv" })], [], [
      makePaymentRecord({ target: { kind: "invoice", invoiceId: "inv" }, gross: 4000 }),
    ]);
    expect(invoice).toMatchObject({ status: "sent", balanceDue: 6000 });
    expect(invoiceDisplayStatus(invoice)).toBe("partial");
  });

  it("owes nothing when void", () => {
    const [invoice] = joined([makeInvoiceRecord({ status: "void", advance: 300 })]);
    expect(invoice).toMatchObject({ status: "void", balanceDue: 0 });
    expect(invoice.settlement).toMatchObject({ owed: 0, entries: [] });
  });

  it("follows the deal it bills", () => {
    const [invoice] = joined(
      [makeInvoiceRecord({ id: "inv", status: "paid" })],
      [makeCampaignRecord({ paymentStatus: "pending", invoiceRef: "X", invoiceId: "inv" })]
    );
    expect(invoice.owner).toEqual(DEAL);
    expect(invoice).toMatchObject({ storedStatus: "paid", status: "sent", balanceDue: 10000 });
  });

  it("keeps the stored status and balance while projection is off", () => {
    const [invoice] = joined(
      [makeInvoiceRecord({ id: "inv", status: "paid", advance: 1000 })],
      [makeCampaignRecord({ paymentStatus: "pending", invoiceRef: "X", invoiceId: "inv" })],
      [],
      false
    );
    expect(invoice).toMatchObject({ status: "paid", balanceDue: 9000 });
    expect(invoice.settlement.target).toEqual(DEAL);
  });

  it("reads a standalone paid invoice as one entry", () => {
    const [invoice] = joined([makeInvoiceRecord({ id: "inv", status: "paid", issueDate: "2026-08-01" })]);
    expect(invoice.settlement.entries).toEqual([
      expect.objectContaining({ id: "legacy:status:invoice:inv", gross: 10000, bucketDate: "2026-08-01" }),
    ]);
  });
});

describe("validatePayment", () => {
  const input: PaymentInput = {
    id: "5f0c6f1e-2b7a-4c1d-9a3e-000000000009",
    target: DEAL,
    date: "2026-10-20",
    gross: 5000,
    tds: 500,
    bankFee: 18,
    receivedInto: "ritika",
    method: "UPI",
    reference: "UTR123",
    note: "",
  };
  const ctx: PaymentValidationContext = {
    mode: "create",
    targetState: "ok",
    owed: 10000,
    settledExcludingThis: 0,
    previousGross: 0,
    today: "2026-10-27",
    existingTarget: null,
  };

  it("accepts a well-formed payment", () => {
    expect(validatePayment(input, ctx)).toBeNull();
  });

  it("refuses a target that cannot take a payment", () => {
    expect(validatePayment(input, { ...ctx, targetState: "missing" })).toMatch(/no longer exists/);
    expect(validatePayment(input, { ...ctx, targetState: "no-cash" })).toMatch(/barter only/);
    expect(
      validatePayment({ ...input, target: { kind: "renewal", campaignId: "X", renewalId: "R0001" } }, { ...ctx, targetState: "no-cash" })
    ).toBe("This renewal was free");
    expect(validatePayment(input, { ...ctx, targetState: "linked-invoice" })).toMatch(/Record the payment on the deal/);
    expect(validatePayment(input, { ...ctx, targetState: "void-invoice" })).toBe("This invoice is void");
    expect(
      validatePayment(input, { ...ctx, mode: "update", existingTarget: { kind: "deal", campaignId: "OTHER" } })
    ).toBe("A payment can't be moved to another deal");
  });

  it("checks the date", () => {
    expect(validatePayment({ ...input, date: "" }, ctx)).toBe("Pick the date the money arrived");
    expect(validatePayment({ ...input, date: "2026-10-28" }, ctx)).toBe("Payments can't be dated in the future");
    expect(validatePayment({ ...input, date: "2015-03-31" }, ctx)).toBe("That date is too early");
  });

  it("checks the amounts", () => {
    expect(validatePayment({ ...input, gross: 0 }, ctx)).toMatch(/amount settled/);
    expect(validatePayment({ ...input, gross: 10.005 }, ctx)).toMatch(/amount settled/);
    expect(validatePayment({ ...input, tds: -1 }, ctx)).toMatch(/zero or more/);
    expect(validatePayment({ ...input, tds: 4000, bankFee: 1001 }, ctx)).toBe(
      "TDS and charges can't be more than the amount settled"
    );
  });

  it("refuses an overpayment on create, and an increase past what is owed", () => {
    expect(validatePayment({ ...input, gross: 12000 }, ctx)).toMatch(/^That is ₹ 2,000 more than the ₹ 10,000 still owed/);
    expect(validatePayment(input, { ...ctx, settledExcludingThis: 10000 })).toBe(ALREADY_PAID_IN_FULL);
    expect(
      validatePayment({ ...input, gross: 6000 }, { ...ctx, mode: "update", existingTarget: DEAL, settledExcludingThis: 5000, previousGross: 5000 })
    ).toMatch(/^That is ₹ 1,000 more/);
  });

  it("still lets a note be edited on a deal that is already overpaid", () => {
    expect(
      validatePayment(
        { ...input, note: "brand paid extra" },
        { ...ctx, mode: "update", existingTarget: DEAL, owed: 4000, settledExcludingThis: 0, previousGross: 5000 }
      )
    ).toBeNull();
  });

  it("needs a payer, a known method and short text", () => {
    expect(validatePayment({ ...input, receivedInto: "nobody" as PaymentInput["receivedInto"] }, ctx)).toBe(
      "Choose whose account it landed in"
    );
    expect(validatePayment({ ...input, method: "Barter" as PaymentInput["method"] }, ctx)).toMatch(/payment method/);
    expect(validatePayment({ ...input, method: null }, ctx)).toBeNull();
    expect(validatePayment({ ...input, reference: "x".repeat(81) }, ctx)).toMatch(/80 characters/);
    expect(validatePayment({ ...input, note: "x".repeat(501) }, ctx)).toMatch(/500 characters/);
  });

  it("reports the first problem only", () => {
    expect(validatePayment({ ...input, date: "", gross: 0 }, { ...ctx, targetState: "missing" })).toMatch(/no longer exists/);
  });

  it("takes only a client UUID as a new id", () => {
    expect(validateNewPaymentId(input.id)).toBeNull();
    expect(validateNewPaymentId("legacy:status:deal:MSP-MC0001")).not.toBeNull();
    expect(validateNewPaymentId("12345")).not.toBeNull();
  });
});

describe("money and records", () => {
  it("computes net with rounding", () => {
    expect(paymentNet({ gross: 20000, tds: 2000, bankFee: 118 })).toBe(17882);
    expect(paymentNet({ gross: 0.3, tds: 0.1, bankFee: 0.1 })).toBe(0.1);
  });

  it("coerces a stored record, rounding at the half-paisa boundary", () => {
    const record = toPaymentRecord({
      id: " p1 ",
      target: { kind: "deal", campaignId: " MSP-MC0001 " },
      date: "02/09/2026",
      gross: 1.005,
      tds: -5,
      bankFee: "x",
      receivedInto: "Ritika",
      method: "upi",
      reference: "  r  ",
      note: 7,
      origin: "manual",
    });
    expect(record).toMatchObject({
      id: "p1",
      target: DEAL,
      date: "2026-09-02",
      gross: 1.01,
      tds: 0,
      bankFee: 0,
      receivedInto: "ritika",
      method: "UPI",
      reference: "r",
      note: "",
      origin: "recorded",
    });
  });

  it("drops a record with no target or nothing settled", () => {
    expect(toPaymentRecord({ id: "p", target: { kind: "deal", campaignId: "" }, gross: 5 })).toBeNull();
    expect(toPaymentRecord({ id: "p", target: DEAL, gross: 0 })).toBeNull();
    expect(toPaymentRecord(null)).toBeNull();
  });

  it("files an entry in the financial year of its date", () => {
    expect(financialYearStart("2027-03-31")).toBe(2026);
    expect(financialYearStart("2027-04-01")).toBe(2027);
  });
});

describe("suggestPayment", () => {
  it("suggests the remaining amount today with TDS at the expected rate, rounded to paise", () => {
    expect(
      suggestPayment({ remaining: 12345.67 }, 10, { receivedInto: "ritika", method: "Bank transfer" }, "2026-10-27")
    ).toEqual({
      date: "2026-10-27",
      gross: 12345.67,
      tds: roundMoney(1234.567),
      bankFee: 0,
      receivedInto: "ritika",
      method: "Bank transfer",
      reference: "",
      note: "",
    });
  });

  it("falls back to Business funds and no TDS", () => {
    expect(suggestPayment({ remaining: 5000 }, null, null, "2026-10-27")).toMatchObject({
      tds: 0,
      receivedInto: "business",
      method: null,
    });
  });
});

describe("warnings and orphans", () => {
  it("warns about an overpaid target", () => {
    const settlement = settle(DEAL, 45000, [entry({ gross: 50000 })], "pending");
    expect(ledgerWarnings({ settlement }).map((w) => w.code)).toEqual(["overpaid"]);
    expect(ledgerWarnings({ settlement })[0].message).toMatch(/^₹ 5,000 more was received/);
  });

  it("finds payments whose deal, renewal or invoice is gone", () => {
    const campaigns = ledgerCampaigns([
      makeCampaignRecord({ usage: makeUsage({ renewals: [makeRenewal({ id: "R0001" })] }) }),
    ]);
    const payments = [
      makePaymentRecord({ id: "live" }),
      makePaymentRecord({ id: "renewal", target: { kind: "renewal", campaignId: "MSP-MC0001", renewalId: "R0001" } }),
      makePaymentRecord({ id: "gone-renewal", target: { kind: "renewal", campaignId: "MSP-MC0001", renewalId: "R0009" } }),
      makePaymentRecord({ id: "gone-deal", target: { kind: "deal", campaignId: "MSP-MC0099" } }),
      makePaymentRecord({ id: "gone-invoice", target: { kind: "invoice", invoiceId: "nope" } }),
    ];
    expect(findOrphanPayments(payments, campaigns, []).map((p) => p.id)).toEqual([
      "gone-renewal",
      "gone-deal",
      "gone-invoice",
    ]);
  });
});

// The spec's four worked examples, with its exact numbers.
describe("worked examples", () => {
  const exampleDeal = makeCampaignRecord({
    amount: 40000,
    usage: makeUsage({ days: 30, fee: 10000 }),
    paymentStatus: "pending",
    tdsRate: 10,
    uploadDate: "20/10/2026",
    invoiceRef: "MSP-INV-0001",
    invoiceId: "inv",
  });
  const exampleInvoice = makeInvoiceRecord({ id: "inv", items: [{ desc: "Reel", sub: "", qty: 1, price: 50000 }] });
  const entryA = makePaymentRecord({
    id: "a",
    date: "2026-11-05",
    gross: 20000,
    tds: 2000,
    bankFee: 118,
    receivedInto: "ritika",
    method: "UPI",
  });
  const entryB = makePaymentRecord({
    id: "b",
    date: "2027-04-10",
    gross: 30000,
    tds: 3000,
    bankFee: 0,
    method: "Bank transfer",
  });

  it("1: partial payments with TDS and a bank fee", () => {
    const afterA = onlyDeal([exampleDeal], [exampleInvoice], [entryA]);
    expect(afterA.settlement).toMatchObject({
      owed: 50000,
      settled: 20000,
      remaining: 30000,
      tds: 2000,
      fee: 118,
      net: 17882,
      status: "partial",
      paidOn: "",
      lastPaidOn: "2026-11-05",
    });
    expect(afterA).toMatchObject({ paymentStatus: "pending", paidDate: "" });
    expect(settlementLabel(afterA.settlement!)).toBe("Partially paid");
    const [invoice] = attachInvoiceSettlements([toInvoice(exampleInvoice)], [afterA], [entryA], true);
    expect(invoiceDisplayStatus(invoice)).toBe("partial");
    expect(invoice.balanceDue).toBe(30000);

    const afterB = onlyDeal([exampleDeal], [exampleInvoice], [entryA, entryB]);
    expect(afterB.settlement).toMatchObject({ status: "paid", paidOn: "2027-04-10", method: "Multiple", remaining: 0 });
    expect(afterB).toMatchObject({ paymentStatus: "received", paidDate: "10/04/2027", tdsAmount: 5000 });
    const [paidInvoice] = attachInvoiceSettlements([toInvoice(exampleInvoice)], [afterB], [entryA, entryB], true);
    expect(paidInvoice).toMatchObject({ status: "paid", balanceDue: 0 });
  });

  it("2: a legacy received deal, then its payment edited into the ledger", () => {
    const legacy = makeCampaignRecord({
      id: "MSP-MC0007",
      amount: 25000,
      paymentStatus: "received",
      tdsRate: 10,
      uploadDate: "14/08/2026",
    });
    const before = onlyDeal([legacy]);
    expect(before.settlement?.entries[0]).toMatchObject({
      id: "legacy:status:deal:MSP-MC0007",
      gross: 25000,
      tds: 2500,
      net: 22500,
      date: "",
      bucketDate: "2026-08-14",
    });
    expect(before).toMatchObject({ paymentStatus: "received", paidDate: "", tdsAmount: null });

    const materialised = makePaymentRecord({
      id: "m",
      target: { kind: "deal", campaignId: "MSP-MC0007" },
      origin: "legacy",
      date: "2026-09-02",
      gross: 25000,
      tds: 2500,
      receivedInto: "subhrajit",
      method: null,
    });
    const after = onlyDeal([{ ...legacy, paymentStatus: "pending" }], [], [materialised]);
    expect(after.settlement).toMatchObject({ hasStored: true, status: "paid", paidOn: "2026-09-02" });
    expect(after).toMatchObject({ paymentStatus: "received", paidDate: "02/09/2026", tdsAmount: 2500 });
    expect(after.settlement?.entries[0].bucketDate).toBe("2026-09-02");
  });

  it("3: an invoice advance, then marked received, then undone", () => {
    const deal = makeCampaignRecord({
      id: "MSP-MC0012",
      amount: 60000,
      paymentStatus: "pending",
      tdsRate: 10,
      invoiceRef: "MSP-INV-0009",
      invoiceId: "0009",
    });
    const invoice = makeInvoiceRecord({
      id: "0009",
      issueDate: "2026-09-01",
      advance: 20000,
      items: [{ desc: "Reel", sub: "", qty: 1, price: 60000 }],
    });
    const before = onlyDeal([deal], [invoice]);
    expect(before.settlement).toMatchObject({ status: "partial", remaining: 40000 });
    expect(before.paymentStatus).toBe("pending");
    const [partialInvoice] = attachInvoiceSettlements([toInvoice(invoice)], [before], [], true);
    expect(invoiceDisplayStatus(partialInvoice)).toBe("partial");
    expect(partialInvoice.balanceDue).toBe(40000);

    const target: PaymentTarget = { kind: "deal", campaignId: "MSP-MC0012" };
    const advance = makePaymentRecord({ id: "adv", target, origin: "legacy", date: "", gross: 20000, receivedInto: null, method: null });
    const received = makePaymentRecord({
      id: "new",
      target,
      ...suggestPayment(before.settlement!, 10, null, "2026-10-27"),
    });
    expect(received).toMatchObject({ gross: 40000, tds: 4000 });
    const paid = onlyDeal([deal], [{ ...invoice, advance: 0 }], [advance, received]);
    expect(paid.settlement).toMatchObject({ status: "paid", paidOn: "2026-10-27" });
    const [paidInvoice] = attachInvoiceSettlements([toInvoice({ ...invoice, advance: 0 })], [paid], [advance, received], true);
    expect(paidInvoice).toMatchObject({ status: "paid", balanceDue: 0 });

    const undone = onlyDeal([deal], [{ ...invoice, advance: 0 }], [advance]);
    expect(undone.settlement).toMatchObject({ status: "partial", settled: 20000 });
  });

  it("4: a deal edited below what was already received", () => {
    const lowered = makeCampaignRecord({ ...exampleDeal, amount: 35000 });
    const deal = onlyDeal([lowered], [exampleInvoice], [entryA, entryB]);
    expect(deal.settlement).toMatchObject({
      owed: 45000,
      settled: 50000,
      remaining: 0,
      overpaid: 5000,
      status: "paid",
      paidOn: "2027-04-10",
    });
    expect(ledgerWarnings({ settlement: deal.settlement! }).map((w) => w.code)).toContain("overpaid");
    expect(
      validatePayment(
        { ...entryA, id: "next", receivedInto: "ritika", gross: 100, tds: 0, bankFee: 0, date: "2027-05-01" },
        {
          mode: "create",
          targetState: "ok",
          owed: 45000,
          settledExcludingThis: 50000,
          previousGross: 0,
          today: "2027-05-01",
          existingTarget: null,
        }
      )
    ).toBe(ALREADY_PAID_IN_FULL);

    const raised = onlyDeal([makeCampaignRecord({ ...exampleDeal, amount: 45000 })], [exampleInvoice], [entryA, entryB]);
    expect(raised.settlement).toMatchObject({ owed: 55000, status: "partial", remaining: 5000 });
    expect(raised.paymentStatus).toBe("pending");
  });
});
