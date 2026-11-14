import { afterEach, describe, expect, it, vi } from "vitest";
import { makeBrandCampaignRecord, makeDuePayment, makeRenewal } from "@/lib/testing/fixtures";
import { emptyUsage } from "@/repositories/campaigns";
import { computeBrandStats, duePaymentOwed, selectDuePayments, summarizeDuePayments } from "./brandCampaignStats";

afterEach(() => {
  vi.useRealTimers();
});

describe("summarizeDuePayments", () => {
  it("is all zeroes for an empty list, with the default 30 day window", () => {
    expect(summarizeDuePayments([])).toEqual({
      count: 0,
      outstanding: 0,
      overdueCount: 0,
      overdueAmount: 0,
      windowDays: 30,
      cashInWindow: 0,
      windowCount: 0,
    });
  });

  it("sums Total for outstanding but only cash for overdue and the window", () => {
    const summary = summarizeDuePayments([
      makeDuePayment({ daysUntilDue: -3, record: { amount: 5000, barterValue: 2000 } }),
      makeDuePayment({ daysUntilDue: 10, record: { amount: 8000 } }),
    ]);

    expect(summary).toEqual({
      count: 2,
      outstanding: 15000,
      overdueCount: 1,
      overdueAmount: 5000,
      windowDays: 30,
      cashInWindow: 13000,
      windowCount: 2,
    });
  });

  it("includes the window's last day and nothing after it", () => {
    const summary = summarizeDuePayments([
      makeDuePayment({ daysUntilDue: 30, record: { amount: 1000 } }),
      makeDuePayment({ daysUntilDue: 31, record: { amount: 2000 } }),
    ]);

    expect(summary).toMatchObject({ outstanding: 3000, cashInWindow: 1000, windowCount: 1 });
  });

  it("keeps barter-only rows out of the window but in the outstanding total", () => {
    const summary = summarizeDuePayments([
      makeDuePayment({ daysUntilDue: 2, record: { amount: 0, barterValue: 4000 } }),
    ]);

    expect(summary).toMatchObject({ count: 1, outstanding: 4000, cashInWindow: 0, windowCount: 0 });
  });

  it("counts an overdue barter-only row as overdue with no cash", () => {
    const summary = summarizeDuePayments([
      makeDuePayment({ daysUntilDue: -1, record: { amount: 0, barterValue: 4000 } }),
    ]);

    expect(summary).toMatchObject({ overdueCount: 1, overdueAmount: 0, windowCount: 0 });
  });

  it("honours a custom window", () => {
    const summary = summarizeDuePayments(
      [
        makeDuePayment({ daysUntilDue: 7, record: { amount: 1000 } }),
        makeDuePayment({ daysUntilDue: 8, record: { amount: 2000 } }),
      ],
      7
    );

    expect(summary).toMatchObject({ windowDays: 7, cashInWindow: 1000, windowCount: 1 });
  });

  it("summarises what selectDuePayments picks from the book on the IST day", () => {
    vi.useFakeTimers();
    // 12:00 IST on 10 May 2026.
    vi.setSystemTime(new Date("2026-05-10T06:30:00.000Z"));

    const due = selectDuePayments([
      makeBrandCampaignRecord({ campaignId: "late", paymentDue: "08/05/2026", amount: 3000 }),
      makeBrandCampaignRecord({ campaignId: "today", paymentDue: "10/05/2026", amount: 2000 }),
      makeBrandCampaignRecord({ campaignId: "edge", paymentDue: "09/06/2026", amount: 1000 }),
      makeBrandCampaignRecord({ campaignId: "far", paymentDue: "10/06/2026", amount: 4000 }),
      makeBrandCampaignRecord({ campaignId: "paid", paymentDue: "08/05/2026", paymentStatus: "received" }),
      makeBrandCampaignRecord({ campaignId: "off", paymentDue: "08/05/2026", status: "Cancelled" }),
      makeBrandCampaignRecord({ campaignId: "undated", paymentDue: "" }),
    ]);

    expect(due.map((entry) => [entry.record.campaignId, entry.daysUntilDue, entry.label])).toEqual([
      ["late", -2, "Overdue by 2 days"],
      ["today", 0, "Due today"],
      ["edge", 30, "Due in 30 days"],
      ["far", 31, "Due in 31 days"],
    ]);
    expect(summarizeDuePayments(due)).toEqual({
      count: 4,
      outstanding: 10000,
      overdueCount: 1,
      overdueAmount: 3000,
      windowDays: 30,
      cashInWindow: 6000,
      windowCount: 3,
    });
  });
});

describe("selectDuePayments: purchases owed back", () => {
  it("lists what a brand still owes back as its own row against the deal's due date, fee paid or not", () => {
    vi.useFakeTimers();
    // 12:00 IST on 10 May 2026.
    vi.setSystemTime(new Date("2026-05-10T06:30:00.000Z"));

    const due = selectDuePayments([
      makeBrandCampaignRecord({ campaignId: "paid", paymentDue: "01/05/2026", paymentStatus: "received", paidDate: "01/05/2026", reimbursementOwed: 182 }),
      makeBrandCampaignRecord({ campaignId: "pending", paymentDue: "15/05/2026", amount: 3000, reimbursementOwed: 500 }),
      makeBrandCampaignRecord({ campaignId: "off", paymentDue: "12/05/2026", status: "Cancelled", reimbursementOwed: 250 }),
      makeBrandCampaignRecord({ campaignId: "undated", paymentDue: "", paymentStatus: "received", reimbursementOwed: 999 }),
      makeBrandCampaignRecord({ campaignId: "square", paymentDue: "01/05/2026", paymentStatus: "received" }),
    ]);

    expect(due.map((entry) => [entry.kind, entry.record.campaignId, entry.daysUntilDue, duePaymentOwed(entry).total])).toEqual([
      ["reimbursement", "paid", -9, 182],
      ["reimbursement", "off", 2, 250],
      ["deal", "pending", 5, 3000],
      ["reimbursement", "pending", 5, 500],
    ]);
  });

  it("counts a purchase owed back as cash, toward the window and once overdue", () => {
    const summary = summarizeDuePayments([
      makeDuePayment({ kind: "reimbursement", daysUntilDue: -9, record: { paymentStatus: "received", reimbursementOwed: 182 } }),
      makeDuePayment({ daysUntilDue: 5, record: { amount: 3000, reimbursementOwed: 500 } }),
      makeDuePayment({ kind: "reimbursement", daysUntilDue: 5, record: { amount: 3000, reimbursementOwed: 500 } }),
    ]);

    expect(summary).toEqual({
      count: 3,
      outstanding: 3682,
      overdueCount: 1,
      overdueAmount: 182,
      windowDays: 30,
      cashInWindow: 3682,
      windowCount: 3,
    });
  });
});

describe("computeBrandStats", () => {
  it("keeps barter out of cash received while total received still counts it", () => {
    const stats = computeBrandStats([
      makeBrandCampaignRecord({
        campaignId: "1",
        amount: 6000,
        barterValue: 4000,
        paymentStatus: "received",
        usage: {
          ...emptyUsage(),
          renewals: [
            makeRenewal({ id: "R1", amount: 2000, paymentStatus: "received" }),
            makeRenewal({ id: "R2", amount: 1500, paymentStatus: "pending" }),
          ],
        },
      }),
      makeBrandCampaignRecord({ campaignId: "2", amount: 3000, barterValue: 1000, paymentStatus: "pending" }),
    ]);

    expect(stats).toMatchObject({
      totalReceived: 12000,
      cashReceived: 8000,
      pending: 5500,
      renewalReceived: 2000,
    });
  });
});
