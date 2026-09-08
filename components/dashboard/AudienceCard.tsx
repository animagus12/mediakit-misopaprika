import { Eye, MousePointerClick, TrendingUp, Users } from "lucide-react";
import { formatClickRate, type LinksPerformanceSummary } from "@/lib/linkStats";
import { cn } from "@/lib/utils";
import { StatTile } from "./StatTile";

// The two tones below are the ones LinksStatCards uses on /links-editor, and
// for the same reason: they group the figures rather than rank them, audience
// in sky and what the audience did in emerald, applied unconditionally so a
// tile does not change colour because its figure happens to be 0.

export interface MediaKitAudience {
  views: number;
  uniqueVisitors: number;
}

interface AudienceCardProps {
  mediaKit: MediaKitAudience;
  links: LinksPerformanceSummary;
  className?: string;
}

/**
 * What the two public pages have actually done.
 *
 * These counters existed but were each buried in the editor that changes the
 * page they measure: the media kit's on /mediakit-generator, the links page's
 * on /links-editor. Neither is somewhere you go to check how things are
 * going, so a creator dashboard whose public pages are the product carried no
 * reach signal at all.
 *
 * Media kit first: it is the page sent to a brand, and its visitor count is
 * the closest thing here to a pipeline. Links follows with what its audience
 * did, since a view that produced no tap is the thing that page can be
 * changed to fix. Each tile opens the editor for the page it measures.
 */
export function AudienceCard({ mediaKit, links, className }: AudienceCardProps) {
  return (
    <section className={cn("space-y-3", className)}>
      <div className="space-y-0.5">
        <h2 className="font-heading text-sm font-semibold">Audience</h2>
        <p className="text-xs text-muted-foreground">Since counting began, on your public pages</p>
      </div>

      {/* Four across, matching every other stat row on the page: it also puts
          both pages' reach on the first row and what the links audience did
          on the second, rather than splitting a page across a row break. */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          icon={Users}
          label="Media kit visitors"
          value={mediaKit.uniqueVisitors.toLocaleString()}
          tone="audience"
          href="/mediakit-generator"
        />
        <StatTile
          icon={Eye}
          label="Media kit views"
          value={mediaKit.views.toLocaleString()}
          tone="audience"
          href="/mediakit-generator"
        />
        <StatTile
          icon={Users}
          label="Links visitors"
          value={links.uniqueVisitors.toLocaleString()}
          tone="audience"
          href="/links-editor"
        />
        <StatTile
          icon={Eye}
          label="Links views"
          value={links.views.toLocaleString()}
          tone="audience"
          href="/links-editor"
        />
        <StatTile
          icon={MousePointerClick}
          label="Link clicks"
          value={links.totalClicks.toLocaleString()}
          tone="action"
          href="/links-editor"
        />
        <StatTile
          icon={TrendingUp}
          label="Click rate"
          value={formatClickRate(links.clickRate)}
          tone="action"
          href="/links-editor"
          title="Clicks per view of /links. Over 100% just means the average visitor tapped more than one link."
        />
      </div>
    </section>
  );
}
