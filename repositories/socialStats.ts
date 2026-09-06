/**
 * Live audience figures, as domain values rather than display strings: the
 * formatting decision belongs to whatever surface renders them.
 *
 * `null` means "no figure available right now", which is a normal state, not
 * an error: Redis may be unconfigured (local dev), the daily refresh may not
 * have run yet, or the cached entry may have aged out of its 26h TTL after a
 * failed cron. Callers must render something sensible without it.
 *
 * Kept apart from socialStats.server.ts: the same split as links.ts and
 * links.writer.server.ts: so client components can hold the type without
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

/**
 * When a platform's cached figure was written, and how long ago that was.
 *
 * `hoursAgo` is computed on the server rather than from a clock read in the
 * component: a relative time derived during render differs between the server
 * pass and hydration, and the mismatch is a real one, not a rounding artefact.
 */
export interface SocialStatUpdate {
  /** ISO timestamp the refresh job wrote the figure. */
  at: string;
  /** Whole hours since, floored. */
  hoursAgo: number;
}

/**
 * Deliberately a sibling of SocialStats rather than fields on it: every value
 * in SocialStats is a count, which is what lets totalFollowers() sum the
 * object's own values instead of naming each platform.
 */
export interface SocialStatsFreshness {
  youtube: SocialStatUpdate | null;
  instagram: SocialStatUpdate | null;
}

/**
 * Health of the stored Instagram access token, for the editor's readout.
 *
 * A union rather than a nullable record because the three ways there is no
 * expiry to show are not the same thing and shouldn't collapse into one:
 * "unknown" is the store being unreachable (or unconfigured, as in local
 * dev), "missing" is the store answering that nothing is seeded yet. Reading
 * the first as the second is what would put "not connected" in front of
 * someone whose integration is fine.
 *
 * Deliberately carries no token: this crosses to a client component, and a
 * credential has no business in a page's props.
 */
export type InstagramTokenStatus =
  | { state: "unknown" }
  | { state: "missing" }
  | {
      state: "ok" | "overdue" | "expired";
      /** ISO timestamp the current token lapses. */
      expiresAt: string;
      /** Whole days left, floored; negative once lapsed. */
      daysRemaining: number;
    };
