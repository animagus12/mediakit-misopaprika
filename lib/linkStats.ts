import type { LinksAnalytics } from "@/repositories/linkStats";
import type { LinksData } from "@/repositories/links";

/**
 * How one link has performed. Derived rather than stored: only the raw counts
 * are persisted, so the rate can never drift out of step with them.
 */
export interface LinkPerformance {
  clicks: number;
  /**
   * Clicks ÷ page views, as a fraction. Null when there are no views to
   * divide by — that is "not measurable yet", which a surface should render
   * differently from a measured 0%.
   *
   * Legitimately exceeds 1: a rate is per page view, and one visitor may tap
   * several links, or the same link twice.
   */
  clickRate: number | null;
}

function rate(clicks: number, views: number): number | null {
  return views > 0 ? clicks / views : null;
}

export function linkPerformance(analytics: LinksAnalytics, itemId: string): LinkPerformance {
  const clicks = analytics.clicksByItem[itemId] ?? 0;
  return { clicks, clickRate: rate(clicks, analytics.views) };
}

export interface LinksPerformanceSummary {
  views: number;
  uniqueVisitors: number;
  totalClicks: number;
  /** Total clicks ÷ views — how many links an average view produced. */
  clickRate: number | null;
}

/**
 * The page-level readout. Clicks are summed over the links that currently
 * exist rather than over every field in the stored map: a deleted link's
 * history stays in the store (ids are never reused, so it would come back
 * intact if the link were restored), but counting it would put clicks in the
 * total that no row on screen accounts for.
 */
export function linksSummary(data: LinksData, analytics: LinksAnalytics): LinksPerformanceSummary {
  const totalClicks = data.sections.reduce(
    (sectionSum, section) =>
      sectionSum +
      section.items.reduce((sum, item) => sum + (analytics.clicksByItem[item.id] ?? 0), 0),
    0
  );

  return {
    views: analytics.views,
    uniqueVisitors: analytics.uniqueVisitors,
    totalClicks,
    clickRate: rate(totalClicks, analytics.views),
  };
}

/**
 * An unmeasurable rate reads as an em dash rather than "0%" — with no views
 * recorded, zero clicks says nothing about the link.
 */
export function formatClickRate(clickRate: number | null): string {
  if (clickRate === null) return "—";
  const percent = clickRate * 100;
  // A decimal matters at 4.2% and is noise at 137%.
  return `${percent.toFixed(percent < 10 ? 1 : 0)}%`;
}
