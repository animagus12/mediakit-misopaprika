import { describe, expect, it } from "vitest";
import { roundMoney, sumMoney } from "./money";

describe("roundMoney", () => {
  it("rounds to whole paise", () => {
    expect(roundMoney(1234.567)).toBe(1234.57);
    expect(roundMoney(1234.564)).toBe(1234.56);
    expect(roundMoney(400)).toBe(400);
  });

  it("removes floating point drift", () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
  });

  it("rounds a half paisa up even when it is stored just below the half", () => {
    expect(roundMoney(1.005)).toBe(1.01);
  });

  it("keeps the sign of a negative amount and never returns negative zero", () => {
    expect(roundMoney(-500.126)).toBe(-500.13);
    expect(Object.is(roundMoney(-0.001), 0)).toBe(true);
  });

  it("reads non-finite input as zero", () => {
    expect(roundMoney(Number.NaN)).toBe(0);
    expect(roundMoney(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("sumMoney", () => {
  it("adds amounts and rounds the total once", () => {
    expect(sumMoney([0.1, 0.2, 0.3])).toBe(0.6);
    expect(sumMoney([10000, 2500.5, 499.25])).toBe(12999.75);
  });

  it("is zero for nothing to add", () => {
    expect(sumMoney([])).toBe(0);
  });

  it("skips non-finite values rather than poisoning the total", () => {
    expect(sumMoney([100, Number.NaN, 50])).toBe(150);
  });

  it("accepts any iterable, such as a Map's values", () => {
    expect(sumMoney(new Map([["a", 1.1], ["b", 2.2]]).values())).toBe(3.3);
  });
});
