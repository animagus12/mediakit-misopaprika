import { Redis } from "@upstash/redis";
import type { YouTubeAnalyticsCache } from "@/services/youtube";

const YOUTUBE_KEY = "youtube_analytics";
const TTL_SECONDS = 60 * 60 * 26; // 26 h — covers daily refresh + buffer

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
  if (!redis) throw new Error("Upstash Redis not configured — set KV_REST_API_URL and KV_REST_API_TOKEN");
  await redis.set(YOUTUBE_KEY, data, { ex: TTL_SECONDS });
}

// Best-effort — a page view shouldn't fail to render because KV is unset or unreachable.
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

// Best-effort — a page view shouldn't fail to render because KV is unset or unreachable.
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
