import { Redis } from "@upstash/redis";
import type { InstagramStatsCache, InstagramTokenRecord } from "@/services/instagram";
import type { YouTubeAnalyticsCache } from "@/services/youtube";

const YOUTUBE_KEY = "youtube_analytics";
const INSTAGRAM_KEY = "instagram_stats";
const TTL_SECONDS = 60 * 60 * 26; // 26 h: covers daily refresh + buffer

// The access token is deliberately NOT given a TTL. The stats above are a
// cache and may lapse harmlessly; the token is the only copy of a credential
// that cannot be re-derived without a fresh OAuth round trip, so expiring it
// would break the integration rather than degrade it.
const INSTAGRAM_TOKEN_KEY = "instagram_token";

const MEDIAKIT_VIEWS_KEY = "mediakit_views";
const MEDIAKIT_UNIQUE_VISITORS_KEY = "mediakit_unique_visitors";

export function getRedis(): Redis | null {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export async function setCachedYouTubeAnalytics(data: YouTubeAnalyticsCache): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new Error("Upstash Redis not configured: set KV_REST_API_URL and KV_REST_API_TOKEN");
  await redis.set(YOUTUBE_KEY, data, { ex: TTL_SECONDS });
}

// Best-effort: a public page shouldn't fail to render because KV is unset,
// unreachable, or because the daily refresh hasn't run yet. Callers treat null
// as "no live figure" and fall back to whatever the author wrote by hand.
export async function getCachedYouTubeAnalytics(): Promise<YouTubeAnalyticsCache | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    return (await redis.get<YouTubeAnalyticsCache>(YOUTUBE_KEY)) ?? null;
  } catch {
    return null;
  }
}

export async function setCachedInstagramStats(data: InstagramStatsCache): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new Error("Upstash Redis not configured: set KV_REST_API_URL and KV_REST_API_TOKEN");
  await redis.set(INSTAGRAM_KEY, data, { ex: TTL_SECONDS });
}

// Best-effort, for the same reason as the YouTube reader above.
export async function getCachedInstagramStats(): Promise<InstagramStatsCache | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    return (await redis.get<InstagramStatsCache>(INSTAGRAM_KEY)) ?? null;
  } catch {
    return null;
  }
}

// Not best-effort: the refresh job must be able to tell "no token stored yet"
// from "couldn't reach Redis". Swallowing the second would re-seed from the
// env var and overwrite a good refreshed token with a stale one.
export async function getInstagramToken(): Promise<InstagramTokenRecord | null> {
  const redis = getRedis();
  if (!redis) throw new Error("Upstash Redis not configured: set KV_REST_API_URL and KV_REST_API_TOKEN");
  return (await redis.get<InstagramTokenRecord>(INSTAGRAM_TOKEN_KEY)) ?? null;
}

export async function setInstagramToken(record: InstagramTokenRecord): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new Error("Upstash Redis not configured: set KV_REST_API_URL and KV_REST_API_TOKEN");
  await redis.set(INSTAGRAM_TOKEN_KEY, record);
}

// Best-effort: a page view shouldn't fail to render because KV is unset or unreachable.
export async function incrementMediaKitViews(): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.incr(MEDIAKIT_VIEWS_KEY);
  } catch {
    // Non-critical: dropping a view count is preferable to breaking the public page.
  }
}

export async function getMediaKitViews(): Promise<number> {
  const redis = getRedis();
  if (!redis) return 0;
  try {
    return (await redis.get<number>(MEDIAKIT_VIEWS_KEY)) ?? 0;
  } catch {
    return 0;
  }
}

// Best-effort: a page view shouldn't fail to render because KV is unset or unreachable.
export async function recordMediaKitVisitor(visitorId: string | undefined): Promise<void> {
  const redis = getRedis();
  if (!redis || !visitorId) return;
  try {
    await redis.sadd(MEDIAKIT_UNIQUE_VISITORS_KEY, visitorId);
  } catch {
    // Non-critical: dropping a visitor from the unique count is preferable to breaking the public page.
  }
}

export async function getMediaKitUniqueVisitors(): Promise<number> {
  const redis = getRedis();
  if (!redis) return 0;
  try {
    return (await redis.scard(MEDIAKIT_UNIQUE_VISITORS_KEY)) ?? 0;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// /links analytics.
//
// Same best-effort contract as the media kit counters above: a public page
// render, or the click that leaves it, must never fail because KV is unset or
// unreachable. Reads answer 0 / {} so the editor renders an honest empty
// state rather than an error.
//
// Clicks live in one hash keyed by LinkItem.id: the id is stable across
// relabelling and reordering (see LinkItem), so a link keeps its history when
// it is renamed or dragged, and one HGETALL fetches every link's total.
// ---------------------------------------------------------------------------

const LINKS_VIEWS_KEY = "links_views";
const LINKS_UNIQUE_VISITORS_KEY = "links_unique_visitors";
const LINKS_CLICKS_KEY = "links_clicks";

export async function incrementLinksViews(): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.incr(LINKS_VIEWS_KEY);
  } catch {
    // Non-critical: dropping a view count is preferable to breaking the public page.
  }
}

export async function getLinksViews(): Promise<number> {
  const redis = getRedis();
  if (!redis) return 0;
  try {
    return (await redis.get<number>(LINKS_VIEWS_KEY)) ?? 0;
  } catch {
    return 0;
  }
}

export async function recordLinksVisitor(visitorId: string | undefined): Promise<void> {
  const redis = getRedis();
  if (!redis || !visitorId) return;
  try {
    await redis.sadd(LINKS_UNIQUE_VISITORS_KEY, visitorId);
  } catch {
    // Non-critical: dropping a visitor from the unique count is preferable to breaking the public page.
  }
}

export async function getLinksUniqueVisitors(): Promise<number> {
  const redis = getRedis();
  if (!redis) return 0;
  try {
    return (await redis.scard(LINKS_UNIQUE_VISITORS_KEY)) ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Callers must have already checked the id against the published page: this
 * writes a new hash field for whatever it is given, so an unvalidated id from
 * a request body would let anyone grow the key without bound.
 */
export async function incrementLinkClick(itemId: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.hincrby(LINKS_CLICKS_KEY, itemId, 1);
  } catch {
    // Non-critical: a lost click is preferable to a failed navigation.
  }
}

/** Total clicks per item id; ids never clicked are simply absent. */
export async function getLinkClicks(): Promise<Record<string, number>> {
  const redis = getRedis();
  if (!redis) return {};
  try {
    const stored = await redis.hgetall<Record<string, string | number>>(LINKS_CLICKS_KEY);
    if (!stored) return {};
    const clicks: Record<string, number> = {};
    for (const [itemId, value] of Object.entries(stored)) {
      const count = Number(value);
      // A field that doesn't parse is a corrupt write, not a zero: skipping it
      // keeps one bad entry out of the totals instead of into them as NaN.
      if (Number.isFinite(count)) clicks[itemId] = count;
    }
    return clicks;
  } catch {
    return {};
  }
}
