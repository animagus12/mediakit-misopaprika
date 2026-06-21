import analyticsJson from "@/data/analytics.json";
import { getCachedYouTubeAnalytics } from "@/lib/cache";

export interface PlatformAnalytics {
  displayName: string;
  description: string;
  totalViews: number;
  accountsReached: number;
  engagementPct: number;
  avgViews: number;
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

class JsonAnalyticsRepository implements IAnalyticsRepository {
  async get(): Promise<AnalyticsData> {
    const base = analyticsJson as AnalyticsData;
    const yt = await getCachedYouTubeAnalytics().catch(() => null);

    if (!yt) return base;

    return {
      ...base,
      platforms: {
        ...base.platforms,
        youtube: {
          ...base.platforms.youtube,
          totalViews: yt.totalViews,
          accountsReached: yt.accountsReached,
          engagementPct: yt.engagementPct,
          avgViews: yt.avgViews,
        },
      },
    };
  }
}

export const analyticsRepository: IAnalyticsRepository = new JsonAnalyticsRepository();
