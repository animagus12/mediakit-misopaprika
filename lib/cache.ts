import { Redis } from "@upstash/redis";
import type { YouTubeAnalyticsCache } from "@/services/youtube";

const YOUTUBE_KEY = "youtube_analytics";
const TTL_SECONDS = 60 * 60 * 26; // 26 h — covers daily refresh + buffer

function getRedis(): Redis | null {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export async function getCachedYouTubeAnalytics(): Promise<YouTubeAnalyticsCache | null> {
  const redis = getRedis();
  if (!redis) return null;
  return redis.get<YouTubeAnalyticsCache>(YOUTUBE_KEY);
}

export async function setCachedYouTubeAnalytics(data: YouTubeAnalyticsCache): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new Error("Upstash Redis not configured — set KV_REST_API_URL and KV_REST_API_TOKEN");
  await redis.set(YOUTUBE_KEY, data, { ex: TTL_SECONDS });
}
