import "server-only";
import { getCachedInstagramStats, getCachedYouTubeAnalytics } from "@/lib/cache";
import type { SocialStats } from "./socialStats";

/**
 * Reads the snapshot `/api/cron/refresh-youtube` writes each morning. Nothing
 * is fetched from YouTube here — a public page render must not depend on a
 * third-party API being up, and the Data API quota is a daily budget.
 */
export async function getSocialStats(): Promise<SocialStats> {
  // Independent reads: one platform's snapshot being absent must not take the
  // other's figure off the page with it.
  const [youtube, instagram] = await Promise.all([
    getCachedYouTubeAnalytics(),
    getCachedInstagramStats(),
  ]);

  // `accountsReached` is channels.list `statistics.subscriberCount` — see
  // fetchYouTubeAnalytics(). A channel that hides its subscriber count
  // reports 0, which is not a figure worth putting on the page.
  const subscribers = youtube?.accountsReached ?? 0;
  const followers = instagram?.followers ?? 0;

  return {
    youtubeSubscribers: subscribers > 0 ? subscribers : null,
    instagramFollowers: followers > 0 ? followers : null,
  };
}
