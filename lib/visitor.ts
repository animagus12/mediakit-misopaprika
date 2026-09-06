import { COOKIE_NAME, verifySessionToken } from "./auth";

// Anonymous first-party identifier used to count unique visitors on the public
// pages. Not a security token — worst case of tampering is a slightly inflated
// count.
export const VISITOR_COOKIE = "mk_visitor_id";
export const VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

/** The session cookie, re-exported so a counting page needs one import. */
export { COOKIE_NAME as SESSION_COOKIE };

/**
 * Whether a request to a public page should be counted as a visit.
 *
 * The owner is excluded — they hold the only valid session, and their own
 * traffic is not the measurement. Without this, simply opening /links-editor
 * inflated the very figures it displays: next/link prefetches the "View live"
 * link, and an RSC prefetch runs the page's server render exactly like a real
 * visit would. Reloading the live page while editing did the same, one view at
 * a time.
 *
 * Excluding at the point of counting, rather than only disabling that prefetch,
 * is what makes the figure trustworthy: it holds for every route to the page,
 * including ones a later edit might add.
 */
export async function isCountableVisit(sessionToken: string | undefined): Promise<boolean> {
  return !(await verifySessionToken(sessionToken));
}
