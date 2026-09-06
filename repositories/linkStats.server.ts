import "server-only";
import { getLinkClicks, getLinksUniqueVisitors, getLinksViews } from "@/lib/cache";
import type { LinksAnalytics } from "./linkStats";

/**
 * Every /links counter in one read, for the editor's performance readout.
 *
 * The three reads are independent so one missing counter can't take the
 * others off the screen with it — each already answers with its own empty
 * value rather than throwing.
 */
export async function getLinksAnalytics(): Promise<LinksAnalytics> {
  const [views, uniqueVisitors, clicksByItem] = await Promise.all([
    getLinksViews(),
    getLinksUniqueVisitors(),
    getLinkClicks(),
  ]);

  return { views, uniqueVisitors, clicksByItem };
}
