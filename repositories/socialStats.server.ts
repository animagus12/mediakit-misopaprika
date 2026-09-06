import "server-only";
import { getCachedInstagramStats, getCachedYouTubeAnalytics, getInstagramToken } from "@/lib/cache";
import { REFRESH_WHEN_REMAINING_MS } from "@/services/instagram";
import type {
  InstagramTokenStatus,
  SocialStats,
  SocialStatUpdate,
  SocialStatsFreshness,
} from "./socialStats";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function toUpdate(lastUpdated: string | undefined, now: number): SocialStatUpdate | null {
  if (!lastUpdated) return null;
  const written = Date.parse(lastUpdated);
  // A record whose timestamp doesn't parse still holds a usable figure; it
  // just can't say when it was written, so the caller shows nothing rather
  // than "NaN hours ago".
  if (Number.isNaN(written)) return null;
  return { at: lastUpdated, hoursAgo: Math.max(0, Math.floor((now - written) / HOUR_MS)) };
}

export interface SocialStatsSnapshot {
  stats: SocialStats;
  freshness: SocialStatsFreshness;
}

/**
 * Reads the snapshots `/api/cron/refresh-youtube` and `refresh-instagram`
 * write each morning, with the figures and their write times taken from the
 * same read: a second pass could report a freshness that doesn't belong to
 * the figure on screen. Nothing is fetched from either API here: a public
 * page render must not depend on a third party being up, and the YouTube
 * Data API quota is a daily budget.
 */
export async function getSocialStatsSnapshot(): Promise<SocialStatsSnapshot> {
  // Independent reads: one platform's snapshot being absent must not take the
  // other's figure off the page with it.
  const [youtube, instagram] = await Promise.all([
    getCachedYouTubeAnalytics(),
    getCachedInstagramStats(),
  ]);
  const now = Date.now();

  // `accountsReached` is channels.list `statistics.subscriberCount`: see
  // fetchYouTubeAnalytics(). A channel that hides its subscriber count
  // reports 0, which is not a figure worth putting on the page.
  const subscribers = youtube?.accountsReached ?? 0;
  const followers = instagram?.followers ?? 0;

  return {
    stats: {
      youtubeSubscribers: subscribers > 0 ? subscribers : null,
      instagramFollowers: followers > 0 ? followers : null,
    },
    freshness: {
      youtube: toUpdate(youtube?.lastUpdated, now),
      instagram: toUpdate(instagram?.lastUpdated, now),
    },
  };
}

/** The figures alone: all the public page needs. */
export async function getSocialStats(): Promise<SocialStats> {
  return (await getSocialStatsSnapshot()).stats;
}

// The daily job renews once a token has less than REFRESH_WHEN_REMAINING_MS
// left, so a working setup never sits deep inside that window. Ten days in
// with no renewal means it is not happening: worth saying while there is
// still a month of headroom, rather than at the point it stops working.
const RENEWAL_GRACE_MS = 10 * DAY_MS;

/**
 * How the Instagram credential is doing, for the links editor's readout.
 * Read-only: renewal itself belongs to the cron, not to a page render.
 */
export async function getInstagramTokenStatus(): Promise<InstagramTokenStatus> {
  let record;
  try {
    record = await getInstagramToken();
  } catch {
    // getInstagramToken() throws rather than returning null when the store is
    // unreachable or unconfigured, precisely so that case stays distinct from
    // "nothing stored". Keep it distinct here too: the editor shows nothing
    // instead of claiming the integration is unconfigured.
    return { state: "unknown" };
  }
  if (!record) return { state: "missing" };

  const remaining = Date.parse(record.expiresAt) - Date.now();
  // An unparseable expiry is a corrupt record, not an expired token: saying
  // "expired" would send someone to redo an OAuth round trip they don't need.
  if (Number.isNaN(remaining)) return { state: "unknown" };

  const state =
    remaining <= 0
      ? "expired"
      : remaining < REFRESH_WHEN_REMAINING_MS - RENEWAL_GRACE_MS
        ? "overdue"
        : "ok";

  return {
    state,
    expiresAt: record.expiresAt,
    daysRemaining: Math.floor(remaining / DAY_MS),
  };
}
