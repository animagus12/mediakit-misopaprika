export interface YouTubeAnalyticsCache {
  lastUpdated: string;
  totalViews: number;
  accountsReached: number;
  engagementPct: number;
  avgViews: number;
}

export interface YouTubeConfig {
  apiKey: string;
  channelId: string;
}

// Only the fields read below. Every one is optional: the API leaves a field
// out rather than sending a zero (a hidden subscriber count, a video with
// likes turned off), and a missing one must read as absent, not crash.
interface ChannelsResponse {
  items?: Array<{
    statistics?: { subscriberCount?: string };
    contentDetails?: { relatedPlaylists?: { uploads?: string } };
  }>;
}

interface PlaylistItemsResponse {
  items?: Array<{
    contentDetails?: { videoId?: string; videoPublishedAt?: string };
  }>;
}

interface VideosResponse {
  items?: Array<{
    statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
  }>;
}

const API = "https://www.googleapis.com/youtube/v3";
const RECENT_WINDOW_MS = 60 * 24 * 60 * 60 * 1000;

/**
 * Both settings, or null when either is missing. Not configured is a state,
 * not a failure: the refresh job skips rather than erroring every morning,
 * and the page renders the figure as absent.
 */
export function youTubeConfig(): YouTubeConfig | null {
  const apiKey = process.env.YOUTUBE_API_KEY;
  const channelId = process.env.YOUTUBE_CHANNEL_ID;
  return apiKey && channelId ? { apiKey, channelId } : null;
}

async function youTubeJson<T>(path: string, params: Record<string, string>, what: string): Promise<T> {
  const res = await fetch(`${API}/${path}?${new URLSearchParams(params)}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`YouTube ${what} failed: ${res.status}`);
  return (await res.json()) as T;
}

function count(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "0", 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function fetchYouTubeAnalytics({ apiKey, channelId }: YouTubeConfig): Promise<YouTubeAnalyticsCache> {
  // Channel stats + uploads playlist ID (costs 3 quota units)
  const channelData = await youTubeJson<ChannelsResponse>(
    "channels",
    { part: "statistics,contentDetails", id: channelId, key: apiKey },
    "channels.list"
  );

  const channel = channelData.items?.[0];
  if (!channel) throw new Error(`Channel not found: ${channelId}`);

  const subscriberCount = count(channel.statistics?.subscriberCount);
  const uploadsPlaylistId = channel.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsPlaylistId) throw new Error(`Channel has no uploads playlist: ${channelId}`);

  // Recent videos from the uploads playlist (costs 1 quota unit)
  const playlistData = await youTubeJson<PlaylistItemsResponse>(
    "playlistItems",
    { part: "contentDetails", playlistId: uploadsPlaylistId, maxResults: "50", key: apiKey },
    "playlistItems.list"
  );

  const cutoff = Date.now() - RECENT_WINDOW_MS;
  const recentIds = (playlistData.items ?? []).flatMap((item) => {
    const videoId = item.contentDetails?.videoId;
    const published = Date.parse(item.contentDetails?.videoPublishedAt ?? "");
    return videoId && published >= cutoff ? [videoId] : [];
  });

  if (recentIds.length === 0) {
    return {
      lastUpdated: new Date().toISOString(),
      totalViews: 0,
      accountsReached: subscriberCount,
      engagementPct: 0,
      avgViews: 0,
    };
  }

  // Per-video stats (costs 1 quota unit per 50 videos)
  const videoData = await youTubeJson<VideosResponse>(
    "videos",
    { part: "statistics", id: recentIds.join(","), key: apiKey },
    "videos.list"
  );

  let totalViews = 0;
  let totalLikes = 0;
  let totalComments = 0;

  const videos = videoData.items ?? [];
  for (const video of videos) {
    totalViews += count(video.statistics?.viewCount);
    totalLikes += count(video.statistics?.likeCount);
    totalComments += count(video.statistics?.commentCount);
  }

  const engagementPct =
    totalViews > 0
      ? +((totalLikes + totalComments) / totalViews * 100).toFixed(1)
      : 0;

  return {
    lastUpdated: new Date().toISOString(),
    totalViews,
    accountsReached: subscriberCount,
    engagementPct,
    avgViews: videos.length > 0 ? Math.round(totalViews / videos.length) : 0,
  };
}
