import { describe, expect, it } from "vitest";
import { amountInWords, roundMoney, sumMoney } from "./money";

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

describe("amountInWords", () => {
  it("writes whole rupees out the way an Indian invoice prints them", () => {
    expect(amountInWords(9500)).toBe("Rupees Nine Thousand Five Hundred Only");
    expect(amountInWords(6000)).toBe("Rupees Six Thousand Only");
    expect(amountInWords(21)).toBe("Rupees Twenty One Only");
    expect(amountInWords(115)).toBe("Rupees One Hundred Fifteen Only");
  });

  it("counts in lakh and crore", () => {
    expect(amountInWords(150000)).toBe("Rupees One Lakh Fifty Thousand Only");
    expect(amountInWords(12345678)).toBe(
      "Rupees One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight Only"
    );
    expect(amountInWords(100000000)).toBe("Rupees Ten Crore Only");
  });

  it("names the crores themselves in lakh and thousand past ninety nine crore", () => {
    expect(amountInWords(1_250_000_000_000)).toBe("Rupees One Lakh Twenty Five Thousand Crore Only");
  });

  it("adds paise when there are any", () => {
    expect(amountInWords(9500.5)).toBe("Rupees Nine Thousand Five Hundred and Fifty Paise Only");
    expect(amountInWords(10.05)).toBe("Rupees Ten and Five Paise Only");
  });

  it("rounds to whole paise first", () => {
    expect(amountInWords(99.999)).toBe("Rupees One Hundred Only");
    expect(amountInWords(0.1 + 0.2)).toBe("Rupees Zero and Thirty Paise Only");
  });

  it("writes zero, and marks a negative amount", () => {
    expect(amountInWords(0)).toBe("Rupees Zero Only");
    expect(amountInWords(-500)).toBe("Minus Rupees Five Hundred Only");
    expect(amountInWords(Number.NaN)).toBe("Rupees Zero Only");
  });
});
