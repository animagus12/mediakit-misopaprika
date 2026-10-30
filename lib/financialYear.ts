import { todayKey } from "@/lib/day";

// The Indian financial year: 1 April to 31 March. A year is named by the
// calendar year it starts in, so 2026 is FY 2026-27 and runs from
// 1 April 2026 to 31 March 2027.
//
// The app stores dates in two shapes. Campaign dates (deal date, upload date,
// paid date, renewal dates) are DD/MM/YYYY, typed the way the creator writes
// them; invoices and other system dates are yyyy-mm-dd. Everything here reads
// both, so a page can filter by year without caring where a date came from.

export interface FinancialYearRange {
  /** First day of the year, yyyy-mm-dd (1 April). */
  from: string;
  /** Last day of the year, yyyy-mm-dd (31 March). */
  to: string;
}

const DMY_PATTERN = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const ISO_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const YEAR_PARAM_PATTERN = /^\d{4}$/;

/**
 * A DD/MM/YYYY or yyyy-mm-dd date as a yyyy-mm-dd day key, or null when it is
 * blank, in another shape, or names a day that does not exist (31/02/2026).
 */
export function toFinancialDayKey(date: string): string | null {
  const text = date.trim();
  let year: number;
  let month: number;
  let day: number;

  const dmy = text.match(DMY_PATTERN);
  const iso = dmy ? null : text.match(ISO_PATTERN);
  if (dmy) {
    [day, month, year] = [Number(dmy[1]), Number(dmy[2]), Number(dmy[3])];
  } else if (iso) {
    [year, month, day] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  } else {
    return null;
  }

  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function startOfYearContaining(year: number, month: number): number {
  return month >= 4 ? year : year - 1;
}

/** The start year of the financial year a date falls in, or null when unreadable. */
export function financialYearStart(date: string): number | null {
  const key = toFinancialDayKey(date);
  if (!key) return null;
  const [year, month] = key.split("-").map(Number);
  return startOfYearContaining(year, month);
}

/**
 * The financial year in progress, on the creator's civil day in IST: 18:30 UTC
 * on 31 March is already 1 April in India.
 */
export function currentFinancialYearStart(now: Date = new Date()): number {
  const [year, month] = todayKey(now).split("-").map(Number);
  return startOfYearContaining(year, month);
}

/** "FY 2026-27". */
export function financialYearLabel(start: number): string {
  return `FY ${start}-${String(start + 1).slice(-2)}`;
}

export function financialYearRange(start: number): FinancialYearRange {
  return { from: `${start}-04-01`, to: `${start + 1}-03-31` };
}

export function isInFinancialYear(date: string, start: number): boolean {
  return financialYearStart(date) === start;
}

/**
 * Every financial year at least one of `dates` falls in, plus the current one,
 * newest first and each once. Unreadable dates are skipped. The current year
 * is always offered so a filter never opens on an empty list.
 */
export function financialYearsPresent(dates: Iterable<string>, now: Date = new Date()): number[] {
  const years = new Set<number>([currentFinancialYearStart(now)]);
  for (const date of dates) {
    const year = financialYearStart(date);
    if (year !== null) years.add(year);
  }
  return [...years].sort((a, b) => b - a);
}

/** The financial year a "YYYY-MM" month key belongs to, or null when malformed. */
export function financialYearOfMonth(monthKey: string): number | null {
  return financialYearStart(`${monthKey}-01`);
}

/** financialYearsPresent for "YYYY-MM" month keys, such as the earnings ledger's months. */
export function financialYearsOfMonths(monthKeys: Iterable<string>, now: Date = new Date()): number[] {
  const firstDays: string[] = [];
  for (const monthKey of monthKeys) firstDays.push(`${monthKey}-01`);
  return financialYearsPresent(firstDays, now);
}

/**
 * The year a `?fy=` search param asks for, when it is one of `years`.
 *
 * null means no usable year was asked for: the param is absent, repeated,
 * malformed, or names a year with nothing in it. Pages with an "All" view
 * read null as "All"; a page that always shows one year falls back to its own
 * default.
 */
export function resolveFinancialYearParam(
  value: string | string[] | undefined,
  years: readonly number[]
): number | null {
  if (typeof value !== "string" || !YEAR_PARAM_PATTERN.test(value)) return null;
  const year = Number(value);
  return years.includes(year) ? year : null;
}

/**
 * Month buckets ("YYYY-MM" in `month`) inside one financial year, in their
 * original order. A null year is the "All" view and returns every month.
 */
export function filterMonthsByFinancialYear<T extends { month: string }>(
  months: readonly T[],
  year: number | null
): T[] {
  if (year === null) return [...months];
  return months.filter((entry) => financialYearOfMonth(entry.month) === year);
}

/**
 * The href for a financial year filter option on `pathname`, keeping every
 * other search param. A null year drops `fy` (the "All" view).
 */
export function financialYearHref(
  pathname: string,
  searchParams: Record<string, string | string[] | undefined>,
  year: number | null
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (key === "fy" || value === undefined) continue;
    for (const entry of Array.isArray(value) ? value : [value]) params.append(key, entry);
  }
  if (year !== null) params.set("fy", String(year));
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
