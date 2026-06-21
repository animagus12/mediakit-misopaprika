import analyticsJson from "@/data/analytics.json";

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
  get(): AnalyticsData;
}

class JsonAnalyticsRepository implements IAnalyticsRepository {
  get(): AnalyticsData {
    return analyticsJson;
  }
}

export const analyticsRepository: IAnalyticsRepository = new JsonAnalyticsRepository();
