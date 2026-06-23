interface RangeMetrics {
  totalViews: number;
  accountsReached: number;
  engagementPct: number;
  avgViews: number;
}

export interface InstagramAnalyticsCache {
  lastUpdated: string;
  byRange: {
    14: RangeMetrics;
    30: RangeMetrics;
    60: RangeMetrics;
  };
}

interface IgReel {
  id: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
  video_views?: number;
}

const BASE = "https://graph.facebook.com/v21.0";

async function fetchInsightTotal(
  userId: string,
  accessToken: string,
  metric: "views" | "reach",
  since: number,
  until: number
): Promise<number> {
  const res = await fetch(
    `${BASE}/${userId}/insights?metric=${metric}&metric_type=total_value&period=day&since=${since}&until=${until}&access_token=${accessToken}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Instagram ${metric} fetch failed: ${res.status}`);
  const data = await res.json();
  return data.data?.[0]?.total_value?.value ?? 0;
}

function computeRange(
  reels: IgReel[],
  days: number,
  totalViews: number,
  accountsReached: number,
  followersCount: number
): RangeMetrics {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const inWindow = reels.filter((r) => new Date(r.timestamp) >= cutoff);

  if (inWindow.length === 0) {
    return { totalViews, accountsReached, engagementPct: 0, avgViews: 0 };
  }

  const reelCount = inWindow.length;
  const totalInteractions = inWindow.reduce(
    (s, r) => s + (r.like_count ?? 0) + (r.comments_count ?? 0),
    0
  );

  // (avg interactions per reel) / followers × 100
  const engagementPct =
    followersCount > 0
      ? +((totalInteractions / reelCount / followersCount) * 100).toFixed(1)
      : 0;

  const totalReelViews = inWindow.reduce((s, r) => s + (r.video_views ?? 0), 0);

  return {
    totalViews,
    accountsReached,
    engagementPct,
    avgViews: Math.round(totalReelViews / reelCount),
  };
}

export async function fetchInstagramAnalytics(): Promise<InstagramAnalyticsCache> {
  const accessToken = process.env.IG_ACCESS_TOKEN;
  // Numeric Instagram Business/Creator Account ID — find it via Graph API Explorer:
  // GET /me/accounts → pick your Page → GET /{page-id}?fields=instagram_business_account
  const userId = process.env.IG_USER_ID;

  if (!accessToken || !userId) {
    throw new Error("IG_ACCESS_TOKEN and IG_USER_ID must be set");
  }

  const now = Math.floor(Date.now() / 1000);
  const since14 = now - 14 * 86400;
  const since30 = now - 30 * 86400;
  const since60 = now - 60 * 86400;
  // Instagram insights max range is 30 days; split 60-day window into two halves
  const mid60 = now - 30 * 86400; // same as since30

  // Fetch profile + reels in parallel
  const [profileRes, reelsRes] = await Promise.all([
    fetch(`${BASE}/${userId}?fields=followers_count&access_token=${accessToken}`, {
      cache: "no-store",
    }),
    fetch(
      `${BASE}/${userId}/reels?fields=id,timestamp,like_count,comments_count,video_views&limit=50&access_token=${accessToken}`,
      { cache: "no-store" }
    ),
  ]);

  if (!profileRes.ok) throw new Error(`Instagram profile fetch failed: ${profileRes.status}`);
  if (!reelsRes.ok) throw new Error(`Instagram reels fetch failed: ${reelsRes.status}`);

  // Parse JSON and fetch all insight ranges in parallel
  const [
    profile,
    reelsData,
    views14,
    reach14,
    views30,
    reach30,
    views60a, // older half: 60-30 days ago
    reach60a,
    views60b, // recent half: 30-0 days ago
    reach60b,
  ] = await Promise.all([
    profileRes.json() as Promise<{ followers_count: number }>,
    reelsRes.json() as Promise<{ data: IgReel[] }>,
    fetchInsightTotal(userId, accessToken, "views", since14, now),
    fetchInsightTotal(userId, accessToken, "reach", since14, now),
    fetchInsightTotal(userId, accessToken, "views", since30, now),
    fetchInsightTotal(userId, accessToken, "reach", since30, now),
    fetchInsightTotal(userId, accessToken, "views", since60, mid60),
    fetchInsightTotal(userId, accessToken, "reach", since60, mid60),
    fetchInsightTotal(userId, accessToken, "views", mid60, now),
    fetchInsightTotal(userId, accessToken, "reach", mid60, now),
  ]);

  const followersCount = profile.followers_count ?? 0;
  const reels: IgReel[] = reelsData.data ?? [];

  return {
    lastUpdated: new Date().toISOString(),
    byRange: {
      14: computeRange(reels, 14, views14, reach14, followersCount),
      30: computeRange(reels, 30, views30, reach30, followersCount),
      // 60-day reach sums two 30-day windows; may slightly overcount accounts seen in both halves
      60: computeRange(reels, 60, views60a + views60b, reach60a + reach60b, followersCount),
    },
  };
}
