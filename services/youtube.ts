interface RangeMetrics {
  totalViews: number;
  accountsReached: number;
  engagementPct: number;
  avgViews: number;
}

export interface YouTubeAnalyticsCache {
  lastUpdated: string;
  byRange: {
    14: RangeMetrics;
    30: RangeMetrics;
    60: RangeMetrics;
  };
}

interface PlaylistItem {
  contentDetails: {
    videoId: string;
    videoPublishedAt: string;
  };
}

interface VideoStats {
  id: string;
  statistics: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
  };
}

interface EnrichedVideo {
  publishedAt: Date;
  views: number;
  likes: number;
  comments: number;
}

function computeRange(
  videos: EnrichedVideo[],
  days: number,
  subscriberCount: number
): RangeMetrics {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const filtered = videos.filter((v) => v.publishedAt >= cutoff);

  if (filtered.length === 0) {
    return { totalViews: 0, accountsReached: subscriberCount, engagementPct: 0, avgViews: 0 };
  }

  const totalViews = filtered.reduce((s, v) => s + v.views, 0);
  const totalInteractions = filtered.reduce((s, v) => s + v.likes + v.comments, 0);
  const videoCount = filtered.length;

  // (avg interactions per video) / subscribers × 100
  const engagementPct =
    subscriberCount > 0
      ? +((totalInteractions / videoCount / subscriberCount) * 100).toFixed(1)
      : 0;

  return {
    totalViews,
    accountsReached: subscriberCount,
    engagementPct,
    avgViews: Math.round(totalViews / videoCount),
  };
}

export async function fetchYouTubeAnalytics(): Promise<YouTubeAnalyticsCache> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  const channelId = process.env.YOUTUBE_CHANNEL_ID;

  if (!apiKey || !channelId) {
    throw new Error("YOUTUBE_API_KEY and YOUTUBE_CHANNEL_ID must be set");
  }

  // Fetch channel stats + uploads playlist ID (costs 3 quota units)
  const channelRes = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=statistics,contentDetails&id=${channelId}&key=${apiKey}`,
    { cache: "no-store" }
  );
  if (!channelRes.ok) throw new Error(`YouTube channels.list failed: ${channelRes.status}`);
  const channelData = await channelRes.json();

  const channel = channelData.items?.[0];
  if (!channel) throw new Error(`Channel not found: ${channelId}`);

  const subscriberCount = parseInt(channel.statistics.subscriberCount ?? "0", 10);
  const uploadsPlaylistId: string = channel.contentDetails.relatedPlaylists.uploads;

  // Fetch up to 50 videos from uploads playlist — covers the last 60 days for most channels
  const playlistRes = await fetch(
    `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId=${uploadsPlaylistId}&maxResults=50&key=${apiKey}`,
    { cache: "no-store" }
  );
  if (!playlistRes.ok) throw new Error(`YouTube playlistItems.list failed: ${playlistRes.status}`);
  const playlistData = await playlistRes.json();

  const cutoff60 = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  const recentItems: PlaylistItem[] = (playlistData.items ?? []).filter(
    (item: PlaylistItem) => {
      const pub = item.contentDetails?.videoPublishedAt;
      return pub && new Date(pub) >= cutoff60;
    }
  );

  const empty = (): RangeMetrics => ({
    totalViews: 0,
    accountsReached: subscriberCount,
    engagementPct: 0,
    avgViews: 0,
  });

  if (recentItems.length === 0) {
    return {
      lastUpdated: new Date().toISOString(),
      byRange: { 14: empty(), 30: empty(), 60: empty() },
    };
  }

  // Fetch per-video stats (costs 1 quota unit per 50 videos)
  const ids = recentItems.map((i) => i.contentDetails.videoId).join(",");
  const videoRes = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${ids}&key=${apiKey}`,
    { cache: "no-store" }
  );
  if (!videoRes.ok) throw new Error(`YouTube videos.list failed: ${videoRes.status}`);
  const videoData = await videoRes.json();

  const statsById = new Map<string, VideoStats["statistics"]>(
    (videoData.items ?? []).map((v: VideoStats) => [v.id, v.statistics])
  );

  const enriched: EnrichedVideo[] = recentItems.map((item) => {
    const stats = statsById.get(item.contentDetails.videoId) ?? {};
    return {
      publishedAt: new Date(item.contentDetails.videoPublishedAt),
      views: parseInt(stats.viewCount ?? "0", 10),
      likes: parseInt(stats.likeCount ?? "0", 10),
      comments: parseInt(stats.commentCount ?? "0", 10),
    };
  });

  return {
    lastUpdated: new Date().toISOString(),
    byRange: {
      14: computeRange(enriched, 14, subscriberCount),
      30: computeRange(enriched, 30, subscriberCount),
      60: computeRange(enriched, 60, subscriberCount),
    },
  };
}
