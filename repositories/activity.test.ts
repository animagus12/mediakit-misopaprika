import { describe, expect, it } from "vitest";
import { describeActivity } from "@/lib/activity";
import { activityActions, isActivity, type Activity, type ActivityEntityType } from "./activity";

// Every entity type, spelled out: a type missing from this list fails to
// compile, so the check below covers the whole union.
const ENTITY_TYPES: Record<ActivityEntityType, true> = {
  brand: true,
  agency: true,
  contact: true,
  campaign: true,
  content: true,
  invoice: true,
  editor: true,
  editorTransaction: true,
  affiliatePartner: true,
  affiliatePayout: true,
  payment: true,
  expense: true,
  partnerTransfer: true,
  links: true,
  mediakit: true,
};

function event(overrides: Partial<Activity> = {}): Activity {
  return {
    id: "e1",
    at: "2026-10-27T06:00:00.000Z",
    action: "campaign.updated",
    entity: { type: "campaign", id: "MSP-MC0001", label: "Acme" },
    ...overrides,
  };
}

describe("isActivity", () => {
  it("accepts every registered action", () => {
    for (const action of activityActions) {
      expect(isActivity(event({ action })), action).toBe(true);
    }
  });

  it("accepts every entity type, the affiliate ones included", () => {
    for (const type of Object.keys(ENTITY_TYPES) as ActivityEntityType[]) {
      expect(isActivity(event({ entity: { type, id: null, label: "x" } })), type).toBe(true);
    }
  });

  it("keeps the old payment actions, so their history still reads", () => {
    expect(activityActions).toEqual(
      expect.arrayContaining([
        "campaign.payment_received",
        "campaign.payment_reverted",
        "campaign.usage_payment_received",
        "campaign.usage_payment_reverted",
        "invoice.paid",
        "affiliatePayout.paid",
      ])
    );
  });

  it("accepts a well-formed parent and refuses a malformed one", () => {
    const payment = {
      action: "payment.recorded" as const,
      entity: { type: "payment" as const, id: "p1", label: "Acme" },
    };
    expect(isActivity(event({ ...payment, parent: { type: "invoice", id: "inv", label: "Invoice 0009" } }))).toBe(true);
    expect(isActivity({ ...event(payment), parent: { type: "nope", id: "x", label: "x" } })).toBe(false);
    expect(isActivity({ ...event(payment), parent: "inv" })).toBe(false);
  });

  it("drops an unknown action or entity type", () => {
    expect(isActivity({ ...event(), action: "campaign.exploded" })).toBe(false);
    expect(isActivity({ ...event(), entity: { type: "spaceship", id: null, label: "x" } })).toBe(false);
  });
});

describe("describeActivity for payments", () => {
  it("names the amount and routes to the Payments page, or the invoice it belongs to", () => {
    const recorded = describeActivity(
      event({ action: "payment.recorded", amount: 20000, entity: { type: "payment", id: "p1", label: "Acme · Launch" } })
    );
    expect(recorded).toMatchObject({
      title: "Payment of ₹ 20,000 recorded for Acme · Launch",
      href: "/payments",
      tone: "positive",
    });
    const onInvoice = describeActivity(
      event({
        action: "payment.deleted",
        entity: { type: "payment", id: "p1", label: "Invoice 0009" },
        parent: { type: "invoice", id: "inv", label: "Invoice 0009" },
      })
    );
    expect(onInvoice).toMatchObject({ title: "Payment for Invoice 0009 deleted", href: "/invoices/inv", tone: "destructive" });
  });
});
