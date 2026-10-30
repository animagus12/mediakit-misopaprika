import { afterEach, describe, expect, it, vi } from "vitest";
import { makeMonthlyEarnings } from "@/lib/testing/fixtures";
import {
  currentFinancialYearStart,
  filterMonthsByFinancialYear,
  financialYearHref,
  financialYearLabel,
  financialYearOfMonth,
  financialYearRange,
  financialYearStart,
  financialYearsOfMonths,
  financialYearsPresent,
  isInFinancialYear,
  resolveFinancialYearParam,
  toFinancialDayKey,
} from "./financialYear";

afterEach(() => {
  vi.useRealTimers();
});

describe("toFinancialDayKey", () => {
  it("reads DD/MM/YYYY and yyyy-mm-dd into one day key", () => {
    expect(toFinancialDayKey("5/4/2026")).toBe("2026-04-05");
    expect(toFinancialDayKey("05/04/2026")).toBe("2026-04-05");
    expect(toFinancialDayKey("2026-04-05")).toBe("2026-04-05");
    expect(toFinancialDayKey(" 2026-04-05 ")).toBe("2026-04-05");
  });

  it("rejects other shapes and days that do not exist", () => {
    expect(toFinancialDayKey("")).toBeNull();
    expect(toFinancialDayKey("2026-4-5")).toBeNull();
    expect(toFinancialDayKey("2026-04-05T10:00:00Z")).toBeNull();
    expect(toFinancialDayKey("2026-02-29")).toBeNull();
    expect(toFinancialDayKey("2026-13-01")).toBeNull();
    expect(toFinancialDayKey("2026-00-10")).toBeNull();
  });
});

describe("financialYearStart", () => {
  it("puts 31 March in the year that started the previous April", () => {
    expect(financialYearStart("31/03/2026")).toBe(2025);
    expect(financialYearStart("2026-03-31")).toBe(2025);
  });

  it("starts a new financial year on 1 April", () => {
    expect(financialYearStart("01/04/2026")).toBe(2026);
    expect(financialYearStart("1/4/2026")).toBe(2026);
    expect(financialYearStart("2026-04-01")).toBe(2026);
    expect(financialYearStart("31/12/2026")).toBe(2026);
    expect(financialYearStart("01/01/2027")).toBe(2026);
    expect(financialYearStart("2027-01-01")).toBe(2026);
  });

  it("tolerates surrounding whitespace", () => {
    expect(financialYearStart(" 15/08/2026 ")).toBe(2026);
  });

  it("rejects dates that do not exist and blank input", () => {
    expect(financialYearStart("31/02/2026")).toBeNull();
    expect(financialYearStart("00/04/2026")).toBeNull();
    expect(financialYearStart("10/13/2026")).toBeNull();
    expect(financialYearStart("")).toBeNull();
  });
});

describe("currentFinancialYearStart", () => {
  // The year turns on the creator's civil day in IST, not the server's UTC
  // clock: 18:30 UTC on 31 March is already 1 April in India.
  it("is still the old year at 23:59 IST on 31 March", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-31T18:29:00.000Z"));
    expect(currentFinancialYearStart()).toBe(2025);
  });

  it("turns over at midnight IST on 1 April", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-31T18:30:00.000Z"));
    expect(currentFinancialYearStart()).toBe(2026);
  });

  it("accepts an explicit instant", () => {
    expect(currentFinancialYearStart(new Date("2027-02-10T00:00:00.000Z"))).toBe(2026);
  });
});

describe("financialYearLabel and financialYearRange", () => {
  it("names the year by both calendar years it spans", () => {
    expect(financialYearLabel(2026)).toBe("FY 2026-27");
    expect(financialYearLabel(2099)).toBe("FY 2099-00");
  });

  it("runs from 1 April to 31 March", () => {
    expect(financialYearRange(2026)).toEqual({ from: "2026-04-01", to: "2027-03-31" });
  });
});

describe("isInFinancialYear", () => {
  it("matches either date format on both edges of the year", () => {
    expect(isInFinancialYear("01/04/2026", 2026)).toBe(true);
    expect(isInFinancialYear("2027-03-31", 2026)).toBe(true);
    expect(isInFinancialYear("31/03/2026", 2026)).toBe(false);
    expect(isInFinancialYear("2027-04-01", 2026)).toBe(false);
  });

  it("is never true for an unreadable date", () => {
    expect(isInFinancialYear("", 2026)).toBe(false);
    expect(isInFinancialYear("soon", 2026)).toBe(false);
  });
});

describe("financialYearsPresent", () => {
  const now = new Date("2026-10-27T06:00:00.000Z");

  it("always offers the current year", () => {
    expect(financialYearsPresent([], now)).toEqual([2026]);
  });

  it("lists each year with a date once, newest first, across both formats", () => {
    expect(
      financialYearsPresent(["15/03/2025", "2025-04-15", "20/04/2025", "", "bad", "2022-06-01"], now)
    ).toEqual([2026, 2025, 2024, 2022]);
  });

  it("reads the current year in IST", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2027-03-31T18:30:00.000Z"));
    expect(financialYearsPresent([])).toEqual([2027]);
  });
});

describe("financialYearOfMonth", () => {
  it("files a month key by the year it falls in", () => {
    expect(financialYearOfMonth("2026-03")).toBe(2025);
    expect(financialYearOfMonth("2026-04")).toBe(2026);
    expect(financialYearOfMonth("2027-03")).toBe(2026);
  });

  it("is null for a malformed key", () => {
    expect(financialYearOfMonth("2026-13")).toBeNull();
    expect(financialYearOfMonth("")).toBeNull();
  });
});

describe("financialYearsOfMonths", () => {
  it("lists the years of month keys plus the current one, skipping malformed keys", () => {
    expect(
      financialYearsOfMonths(["2026-05", "2026-03", "2025-04", "bad"], new Date("2026-10-27T06:00:00.000Z"))
    ).toEqual([2026, 2025]);
  });
});

describe("resolveFinancialYearParam", () => {
  const years = [2026, 2025];

  it("returns a listed year", () => {
    expect(resolveFinancialYearParam("2025", years)).toBe(2025);
  });

  it("is null when absent, repeated, malformed or not listed", () => {
    expect(resolveFinancialYearParam(undefined, years)).toBeNull();
    expect(resolveFinancialYearParam(["2025", "2026"], years)).toBeNull();
    expect(resolveFinancialYearParam("all", years)).toBeNull();
    expect(resolveFinancialYearParam("25", years)).toBeNull();
    expect(resolveFinancialYearParam("2019", years)).toBeNull();
  });
});

describe("filterMonthsByFinancialYear", () => {
  const months = [
    makeMonthlyEarnings("2027-04"),
    makeMonthlyEarnings("2027-03"),
    makeMonthlyEarnings("2026-04"),
    makeMonthlyEarnings("2026-03"),
  ];

  it("keeps only the April to March months of the year, in order", () => {
    expect(filterMonthsByFinancialYear(months, 2026).map((m) => m.month)).toEqual(["2027-03", "2026-04"]);
  });

  it("keeps every month for the All view", () => {
    expect(filterMonthsByFinancialYear(months, null)).toEqual(months);
  });
});

describe("financialYearHref", () => {
  it("sets fy and keeps every other param", () => {
    expect(financialYearHref("/invoices", { tab: "unpaid", q: "acme co", fy: "2024" }, 2025)).toBe(
      "/invoices?tab=unpaid&q=acme+co&fy=2025"
    );
  });

  it("drops fy for the All view", () => {
    expect(financialYearHref("/invoices", { fy: "2025" }, null)).toBe("/invoices");
    expect(financialYearHref("/invoices", { tab: "paid", fy: "2025" }, null)).toBe("/invoices?tab=paid");
  });

  it("keeps repeated params and skips undefined ones", () => {
    expect(financialYearHref("/campaigns", { tag: ["a", "b"], q: undefined }, 2026)).toBe(
      "/campaigns?tag=a&tag=b&fy=2026"
    );
  });
});
