// The creator's civil day: "which date is this, to the person reading it".
//
// Two things are kept apart here, because conflating them is where calendar
// bugs come from:
//
//   * Turning an *instant* into a date needs a timezone, and the zone is
//     fixed rather than the server's or the viewer's. The reader is in IST;
//     rendering happens on a UTC server, so "today" read off the server clock
//     files everything before 05:30 IST under the previous day. lib/activity.ts
//     made the same call for its day headings and shares the formatter below.
//   * Arithmetic *between* dates ("five days after the 28th") needs no zone at
//     all, and is done here in UTC precisely so no zone can shift the answer.
//     Working in local time would drop or duplicate a day across a DST
//     boundary, which IST doesn't have but the server's zone might.
//
// A "day key" throughout is yyyy-mm-dd, and a "month key" is yyyy-mm. Both
// sort correctly as plain strings, which is why the calendar compares dates
// by string rather than by timestamp.

export const CALENDAR_TIME_ZONE = "Asia/Kolkata";

// en-CA is the locale whose short date is already yyyy-mm-dd, so the parts
// come back in the order they need to be joined in.
const DAY_KEY = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: CALENDAR_TIME_ZONE,
});

const DAY_LABEL = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const MONTH_LABEL = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const DAY_MS = 86_400_000;
const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_KEY_PATTERN = /^\d{4}-\d{2}$/;

/** Monday first: the week a content schedule is planned around. */
export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export function isDayKey(value: string): boolean {
  return DAY_KEY_PATTERN.test(value) && !Number.isNaN(toUtcMs(value));
}

export function isMonthKey(value: string): boolean {
  return MONTH_KEY_PATTERN.test(value) && !Number.isNaN(toUtcMs(`${value}-01`));
}

/** The day an instant falls on, in CALENDAR_TIME_ZONE. */
export function dayKeyOf(at: Date | string): string {
  const date = typeof at === "string" ? new Date(at) : at;
  return Number.isNaN(date.getTime()) ? "" : DAY_KEY.format(date);
}

export function todayKey(now: Date = new Date()): string {
  return dayKeyOf(now);
}

export function monthKeyOf(dayKey: string): string {
  return dayKey.slice(0, 7);
}

// Anchoring a day key at UTC midnight is what makes the arithmetic below
// zone-proof: every key maps to exactly one instant, and back again.
function toUtcMs(dayKey: string): number {
  const [year, month, day] = dayKey.split("-").map(Number);
  if (!year || !month || !day) return Number.NaN;
  // Date.UTC rolls an out-of-range part forward rather than rejecting it, and
  // it rolls the two parts differently: 2026-02-31 lands on 3 March, where
  // the day no longer matches, but 2026-13-01 lands on 1 January 2027, where
  // it still does. So the month is bounds-checked and the day round-tripped.
  if (month < 1 || month > 12) return Number.NaN;
  const ms = Date.UTC(year, month - 1, day);
  return new Date(ms).getUTCDate() === day ? ms : Number.NaN;
}

function fromUtcMs(ms: number): string {
  const date = new Date(ms);
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}-${day}`;
}

export function addDays(dayKey: string, days: number): string {
  return fromUtcMs(toUtcMs(dayKey) + days * DAY_MS);
}

/** Whole days from `from` to `to`; negative when `to` is the earlier one. */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / DAY_MS);
}

/**
 * The same day of the month, `months` later, clamped to the target month's
 * length: a licence taken out on 31 January and granted one month runs to
 * 28 February, not to the 3rd of March.
 *
 * Distinct from addMonths above, which shifts a *month* key. Both are needed:
 * a usage term is counted in months from a day, and the earnings breakdown is
 * bucketed by month.
 */
export function addMonthsToDay(dayKey: string, months: number): string {
  const [year, month, day] = dayKey.split("-").map(Number);
  if (!year || !month || !day) return "";
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)
  ).getUTCDate();
  return fromUtcMs(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(day, lastDay))
  );
}

export function addMonths(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Every day key in a month, in order. */
export function daysInMonth(monthKey: string): string[] {
  const first = `${monthKey}-01`;
  const next = `${addMonths(monthKey, 1)}-01`;
  const keys: string[] = [];
  for (let key = first; key !== next; key = addDays(key, 1)) keys.push(key);
  return keys;
}

/** 0 = Monday ... 6 = Sunday, matching WEEKDAY_LABELS. */
export function weekdayIndex(dayKey: string): number {
  return (new Date(toUtcMs(dayKey)).getUTCDay() + 6) % 7;
}

/** "Mon 7 Sep". Formatted in UTC because that is where the key is anchored. */
export function formatDayLabel(dayKey: string): string {
  return DAY_LABEL.format(new Date(toUtcMs(dayKey)));
}

/** "September 2026". */
export function formatMonthLabel(monthKey: string): string {
  return MONTH_LABEL.format(new Date(toUtcMs(`${monthKey}-01`)));
}
