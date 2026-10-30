import { describe, expect, it } from "vitest";
import { isPayer, payerLabel, toPayer, toPaymentMethod } from "./payers";

describe("toPayer", () => {
  it("reads values and labels without regard to case or spaces", () => {
    expect(toPayer("ritika")).toBe("ritika");
    expect(toPayer(" Subhrajit ")).toBe("subhrajit");
    expect(toPayer("Business funds")).toBe("business");
    expect(toPayer("BUSINESS")).toBe("business");
  });

  it("returns undefined for anything that isn't a payer", () => {
    expect(toPayer("someone")).toBeUndefined();
    expect(toPayer("")).toBeUndefined();
    expect(toPayer(null)).toBeUndefined();
    expect(toPayer(3)).toBeUndefined();
  });
});

describe("isPayer", () => {
  it("accepts only the exact stored values", () => {
    expect(isPayer("business")).toBe(true);
    expect(isPayer("Business")).toBe(false);
    expect(isPayer(undefined)).toBe(false);
  });
});

describe("payerLabel", () => {
  it("names the payer, or nothing when there isn't one", () => {
    expect(payerLabel("business")).toBe("Business funds");
    expect(payerLabel(undefined)).toBe("");
  });
});

describe("toPaymentMethod", () => {
  it("returns the canonical spelling of a known method", () => {
    expect(toPaymentMethod("upi")).toBe("UPI");
    expect(toPaymentMethod(" bank transfer ")).toBe("Bank transfer");
  });

  it("returns undefined for unknown or empty values", () => {
    expect(toPaymentMethod("Cheque")).toBeUndefined();
    expect(toPaymentMethod("")).toBeUndefined();
    expect(toPaymentMethod(undefined)).toBeUndefined();
  });
});
