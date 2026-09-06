/**
 * What the /links page has done, as domain values rather than display strings
 *: the formatting decision belongs to whatever surface renders them.
 *
 * Zero is a real, honest answer here rather than "unknown": the counters are
 * best-effort (see lib/cache), so an unconfigured or unreachable store reads
 * as a page that hasn't been seen yet, which is what the editor should show
 * instead of an error.
 *
 * Kept apart from linkStats.server.ts: the same split as links.ts and
 * links.writer.server.ts: so client components can hold the type without
 * pulling a server-only Redis read into their bundle.
 */
export interface LinksAnalytics {
  /** Renders of /links, counted once per request. */
  views: number;
  /** Distinct anonymous visitor cookies seen on /links: see lib/visitor. */
  uniqueVisitors: number;
  /**
   * Clicks per LinkItem.id. Links never clicked are absent rather than 0, so
   * the map stays a record of what happened; callers default the lookup.
   */
  clicksByItem: Record<string, number>;
}

