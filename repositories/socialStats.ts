/**
 * Live audience figures, as domain values rather than display strings — the
 * formatting decision belongs to whatever surface renders them.
 *
 * `null` means "no figure available right now", which is a normal state, not
 * an error: Redis may be unconfigured (local dev), the daily refresh may not
 * have run yet, or the cached entry may have aged out of its 26h TTL after a
 * failed cron. Callers must render something sensible without it.
 *
 * Kept apart from socialStats.server.ts — the same split as links.ts and
 * links.writer.server.ts — so client components can hold the type without
 * pulling a server-only Redis read into their bundle.
 */
export interface SocialStats {
  youtubeSubscribers: number | null;
  instagramFollowers: number | null;
}

export const EMPTY_SOCIAL_STATS: SocialStats = {
  youtubeSubscribers: null,
  instagramFollowers: null,
};
