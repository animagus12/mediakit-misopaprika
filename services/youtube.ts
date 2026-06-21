export interface YouTubeAnalyticsCache {
  lastUpdated: string;
  totalViews: number;
  accountsReached: number;
  engagementPct: number;
  avgViews: number;
}

interface PlaylistItem {
  contentDetails: {
    videoId: string;
    videoPublishedAt: string;
  };
}

interface VideoStats {
  statistics: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
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

  // Fetch recent videos from uploads playlist (last 60 days, costs 1 quota unit)
  const playlistRes = await fetch(
    `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId=${uploadsPlaylistId}&maxResults=50&key=${apiKey}`,
    { cache: "no-store" }
  );
  if (!playlistRes.ok) throw new Error(`YouTube playlistItems.list failed: ${playlistRes.status}`);
  const playlistData = await playlistRes.json();

  const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  const recentItems: PlaylistItem[] = (playlistData.items ?? []).filter((item: PlaylistItem) => {
    const published = item.contentDetails?.videoPublishedAt;
    return published && new Date(published) >= cutoff;
  });

  if (recentItems.length === 0) {
    return {
      lastUpdated: new Date().toISOString(),
      totalViews: 0,
      accountsReached: subscriberCount,
      engagementPct: 0,
      avgViews: 0,
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

  let totalViews = 0;
  let totalLikes = 0;
  let totalComments = 0;

  for (const video of (videoData.items ?? []) as VideoStats[]) {
    totalViews += parseInt(video.statistics.viewCount ?? "0", 10);
    totalLikes += parseInt(video.statistics.likeCount ?? "0", 10);
    totalComments += parseInt(video.statistics.commentCount ?? "0", 10);
  }

  const videoCount = (videoData.items ?? []).length;
  const engagementPct =
    totalViews > 0
      ? +((totalLikes + totalComments) / totalViews * 100).toFixed(1)
      : 0;

  return {
    lastUpdated: new Date().toISOString(),
    totalViews,
    accountsReached: subscriberCount,
    engagementPct,
    avgViews: videoCount > 0 ? Math.round(totalViews / videoCount) : 0,
  };
}
