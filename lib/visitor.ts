import { COOKIE_NAME, verifySessionToken } from "./auth";

// Anonymous first-party identifier used to count unique visitors on the public
// pages. Not a security token: worst case of tampering is a slightly inflated
// count.
export const VISITOR_COOKIE = "mk_visitor_id";
export const VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

/** The session cookie, re-exported so a counting page needs one import. */
export { COOKIE_NAME as SESSION_COOKIE };

// Crawlers and link-preview fetchers name themselves, nearly always as a
// "...bot/1.0"-style token or with a "+https://" page about the bot. The rest
// are the preview fetchers and HTTP libraries that don't. A bare "bot" is not
// enough on its own: it is inside real phone names (a "CUBOT X30" browser).
const BOT_USER_AGENT =
  /(bot|crawler|spider)[/\-_;)]|\+https?:\/\/|facebookexternalhit|whatsapp\/|skypeuripreview|embedly|google-inspectiontool|headlesschrome|lighthouse|^curl\/|^wget\/|python-(requests|urllib)|go-http-client|node-fetch|undici|axios\/|okhttp\/|^java\/|apache-httpclient|scrapy/i;

/**
 * Whether a request most likely came from software rather than a person.
 * No user agent at all counts as software: every browser sends one.
 */
export function isLikelyBot(userAgent: string | null | undefined): boolean {
  return !userAgent?.trim() || BOT_USER_AGENT.test(userAgent);
}

/**
 * Whether a request to a public page should be counted as a visit, or a
 * click on one as a click.
 *
 * The owner is excluded: they hold the only valid session, and their own
 * traffic is not the measurement. Without this, simply opening /links-editor
 * inflated the very figures it displays: next/link prefetches the "View live"
 * link, and an RSC prefetch runs the page's server render exactly like a real
 * visit would. Reloading the live page while editing did the same, one view at
 * a time.
 *
 * Excluding at the point of counting, rather than only disabling that prefetch,
 * is what makes the figure trustworthy: it holds for every route to the page,
 * including ones a later edit might add.
 *
 * Bots are excluded too. A crawler or a chat app fetching a link preview
 * keeps no cookies, so every one of its requests arrived with a fresh
 * visitor id and counted as both a view and a new unique visitor.
 */
export async function isCountableVisit(
  sessionToken: string | undefined,
  userAgent: string | null | undefined
): Promise<boolean> {
  if (isLikelyBot(userAgent)) return false;
  return !(await verifySessionToken(sessionToken));
}
