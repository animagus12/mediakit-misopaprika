import { daysBetween, formatDayLabel, todayKey } from "@/lib/day";
import type { CheckIn, CheckInSubjectKind } from "@/repositories/brandCheckIns";

// When a conversation that never became a deal is worth another message, and
// when it is worth giving up on.
//
// Client-safe (no "server-only"): the brand tab and the dashboard card both
// render these states, and both take already-fetched check-ins.

/**
 * How long silence runs before a pursuit with no promised date is worth
 * another message. A week is one full working cycle: long enough that the
 * brand has seen the message and had a chance to act on it, short enough that
 * the conversation has not gone cold on its own.
 */
export const FOLLOW_UP_AFTER_DAYS = 7;

/**
 * Unanswered messages before a pursuit is worth closing.
 *
 * Counted from the last *reply*, not from the first message ever sent: a brand
 * that answered the second nudge and then went quiet is on a streak of one,
 * not three. Counting raw check-ins would close conversations that are moving.
 */
export const CHECK_INS_BEFORE_CLOSING = 2;

/**
 * What to do about a pursuit.
 *
 * `holding` is the state the promised-date field exists for: a brand that said
 * it would answer by the 15th should not appear on the dashboard on the 9th
 * telling the creator to nudge them. A date still ahead suppresses both the
 * rolling FOLLOW_UP_AFTER_DAYS nudge and the closing prompt, because a live
 * promise is newer evidence than the silence that preceded it: a pursuit that
 * has just been given a date is not one to give up on. Once the date passes it
 * stops protecting anything, and the streak decides between `overdue` and
 * `close` as it would have without it.
 */
export type OutreachState = "close" | "overdue" | "due" | "holding" | "quiet";

export interface OutreachStatus {
  state: OutreachState;
  /** Check-ins since the last reply. What CHECK_INS_BEFORE_CLOSING is compared against. */
  unanswered: number;
  /** Day key of the most recent check-in, or null when none has been logged. */
  lastCheckIn: string | null;
  /** Days since `lastCheckIn`; 0 when there is none. */
  daysSince: number;
  /** The governing promised date while the loop is open, else null. */
  respondBy: string | null;
  /** Days until `respondBy`; negative once it has passed, 0 when there is none. */
  daysToRespondBy: number;
  /** What is unresolved, in a few words. */
  label: string;
}

export const NO_OUTREACH: OutreachStatus = {
  state: "quiet",
  unanswered: 0,
  lastCheckIn: null,
  daysSince: 0,
  respondBy: null,
  daysToRespondBy: 0,
  label: "",
};

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/** Oldest first, breaking same-day ties by when each was actually logged. */
export function sortCheckIns(checkIns: CheckIn[]): CheckIn[] {
  return [...checkIns].sort(
    (a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt)
  );
}

export function checkInsForSubject(
  checkIns: CheckIn[],
  subjectKind: CheckInSubjectKind,
  subjectId: string
): CheckIn[] {
  return checkIns.filter(
    (checkIn) => checkIn.subjectKind === subjectKind && checkIn.subjectId === subjectId
  );
}

/**
 * Where one pursuit stands, from its check-in log alone.
 *
 * A check-in that got a reply closes its own loop and leaves the pursuit
 * `quiet`: the ball is back with the creator, and the next thing to happen is
 * a check-in they choose to log. Nudging on replies too would mean the
 * dashboard card never empties, which is the fastest way to make it ignored.
 */
export function outreachStatus(checkIns: CheckIn[], now: Date = new Date()): OutreachStatus {
  const sorted = sortCheckIns(checkIns);
  const last = sorted[sorted.length - 1];
  if (!last) return NO_OUTREACH;

  let unanswered = 0;
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    if (sorted[i].replied) break;
    unanswered += 1;
  }

  const today = todayKey(now);
  const daysSince = daysBetween(last.date, today);
  const base: OutreachStatus = {
    ...NO_OUTREACH,
    unanswered,
    lastCheckIn: last.date,
    daysSince,
  };

  if (unanswered === 0) return base;

  // Only the most recent check-in's promised date governs: an earlier one has
  // been superseded by the message sent after it.
  const respondBy = last.respondBy;
  const daysToRespondBy = respondBy ? daysBetween(today, respondBy) : 0;

  // Checked before the streak on purpose. A date the brand has not reached yet
  // is the freshest thing on the record, and telling the creator to close a
  // pursuit on the same day they were promised an answer would be wrong.
  if (respondBy && daysToRespondBy >= 0) {
    return {
      ...base,
      state: "holding",
      respondBy,
      daysToRespondBy,
      label: `Answer promised by ${formatDayLabel(respondBy)}`,
    };
  }

  if (unanswered >= CHECK_INS_BEFORE_CLOSING) {
    return {
      ...base,
      state: "close",
      respondBy,
      daysToRespondBy,
      label: `${plural(unanswered, "check-in")}, no reply`,
    };
  }

  if (respondBy) {
    return {
      ...base,
      state: "overdue",
      respondBy,
      daysToRespondBy,
      label: `Missed their own date by ${plural(-daysToRespondBy, "day")}`,
    };
  }

  if (daysSince >= FOLLOW_UP_AFTER_DAYS) {
    return { ...base, state: "due", label: `No reply in ${plural(daysSince, "day")}` };
  }

  return base;
}

/** A brand or agency the creator is still chasing, as the alert list needs it. */
export interface OutreachSubject {
  kind: CheckInSubjectKind;
  id: string;
  name: string;
}

export interface OutreachAlert extends OutreachStatus {
  subjectKind: CheckInSubjectKind;
  subjectId: string;
  name: string;
  href: string;
}

// Sharpest first: a pursuit that is ready to close needs a decision, a missed
// date is a harder signal than plain silence, and within each state the one
// that has waited longest leads.
const STATE_RANK: Record<OutreachState, number> = {
  close: 0,
  overdue: 1,
  due: 2,
  holding: 3,
  quiet: 4,
};

// Agencies have no detail page of their own: they are listed on /brands, which
// is where a row about one should land.
function hrefForSubject(subject: OutreachSubject): string {
  return subject.kind === "brand" ? `/brands/${subject.id}` : "/brands";
}

/**
 * Every pursuit with something to do about it, sharpest first.
 *
 * `holding` and `quiet` are left out: both mean the creator is correctly doing
 * nothing, and a card that lists them is a card that stops being read. They
 * are still shown on the subject's own check-in tab, where the question being
 * asked is "where does this one stand" rather than "what needs me today".
 *
 * `subjects` is expected to be filtered to live pursuits already: see
 * isBrandInPursuit in lib/brands.ts, which is where brand status is decided.
 */
export function selectOutreachAlerts(
  checkIns: CheckIn[],
  subjects: OutreachSubject[],
  now: Date = new Date()
): OutreachAlert[] {
  const alerts: OutreachAlert[] = [];

  for (const subject of subjects) {
    const status = outreachStatus(checkInsForSubject(checkIns, subject.kind, subject.id), now);
    if (status.state === "holding" || status.state === "quiet") continue;
    alerts.push({
      ...status,
      subjectKind: subject.kind,
      subjectId: subject.id,
      name: subject.name,
      href: hrefForSubject(subject),
    });
  }

  return alerts.sort(
    (a, b) => STATE_RANK[a.state] - STATE_RANK[b.state] || b.daysSince - a.daysSince
  );
}
