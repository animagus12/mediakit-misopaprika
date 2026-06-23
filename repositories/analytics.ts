import analyticsJson from "@/data/analytics.json";
import { getCachedYouTubeAnalytics, getCachedInstagramAnalytics } from "@/lib/cache";

export interface PlatformRangeMetrics {
  totalViews: number;
  accountsReached: number;
  engagementPct: number;
  avgViews: number;
}

export interface PlatformAnalytics {
  displayName: string;
  description: string;
  byRange: Record<14 | 30 | 60, PlatformRangeMetrics>;
}

export interface AnalyticsData {
  title: string;
  description: string;
  ranges: number[];
  platforms: {
    instagram: PlatformAnalytics;
    youtube: PlatformAnalytics;
  };
}

export interface IAnalyticsRepository {
  get(): Promise<AnalyticsData>;
}

function mergeRange(
  live: PlatformRangeMetrics,
  fallback: PlatformRangeMetrics
): PlatformRangeMetrics {
  return {
    ...live,
    engagementPct: live.engagementPct || fallback.engagementPct,
    avgViews: live.avgViews || fallback.avgViews,
  };
}

function mergeByRange(
  live: PlatformAnalytics["byRange"],
  fallback: PlatformAnalytics["byRange"]
): PlatformAnalytics["byRange"] {
  return {
    14: mergeRange(live[14], fallback[14]),
    30: mergeRange(live[30], fallback[30]),
    60: mergeRange(live[60], fallback[60]),
  };
}

class JsonAnalyticsRepository implements IAnalyticsRepository {
  async get(): Promise<AnalyticsData> {
    const base = analyticsJson as unknown as AnalyticsData;
    const [yt, ig] = await Promise.all([
      getCachedYouTubeAnalytics().catch(() => null),
      getCachedInstagramAnalytics().catch(() => null),
    ]);

    return {
      ...base,
      platforms: {
        instagram: ig
          ? { ...base.platforms.instagram, byRange: mergeByRange(ig.byRange, base.platforms.instagram.byRange) }
          : base.platforms.instagram,
        youtube: yt
          ? { ...base.platforms.youtube, byRange: mergeByRange(yt.byRange, base.platforms.youtube.byRange) }
          : base.platforms.youtube,
      },
    };
  }
}

export const analyticsRepository: IAnalyticsRepository = new JsonAnalyticsRepository();
