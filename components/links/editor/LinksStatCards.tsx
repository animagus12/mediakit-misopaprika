import { Eye, MousePointerClick, TrendingUp, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatClickRate, type LinksPerformanceSummary } from "@/lib/linkStats";
import { cn } from "@/lib/utils";

// Same tone system as the brands and editor-transactions stat cards, so count
// tiles read consistently across the dashboard: a raw palette hue at low
// opacity, since globals.css has no success/info token.
//
// Tones group the four figures rather than rank them — audience in sky, what
// the audience did in emerald — and are applied unconditionally, as on
// /brands, so a tile doesn't change colour just because its figure is 0.
const TONES = {
  audience: {
    card: "bg-sky-500/5 ring-sky-500/15",
    value: "text-sky-600 dark:text-sky-400",
  },
  action: {
    card: "bg-emerald-500/5 ring-emerald-500/15",
    value: "text-emerald-600 dark:text-emerald-400",
  },
} as const;

interface StatTileProps {
  icon: LucideIcon;
  label: string;
  value: string;
  tone: keyof typeof TONES;
  hint?: string;
}

function StatTile({ icon: Icon, label, value, tone, hint }: StatTileProps) {
  return (
    <Card className={TONES[tone].card} title={hint}>
      <CardHeader>
        <CardDescription className="flex items-center gap-1.5">
          <Icon className="size-3.5" />
          {label}
        </CardDescription>
        <CardTitle className={cn("text-lg tabular-nums", TONES[tone].value)}>{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

interface LinksStatCardsProps {
  summary: LinksPerformanceSummary;
}

/**
 * What /links has done, above the editor that changes it. Read-only, and
 * deliberately the first thing on the page: every decision the editor invites
 * — what to feature, what to retire, whether a code still earns its slot —
 * is one of these four figures' to inform.
 */
export function LinksStatCards({ summary }: LinksStatCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatTile
        icon={Eye}
        label="Views on /links"
        value={summary.views.toLocaleString()}
        tone="audience"
      />
      <StatTile
        icon={Users}
        label="Unique visitors"
        value={summary.uniqueVisitors.toLocaleString()}
        tone="audience"
      />
      <StatTile
        icon={MousePointerClick}
        label="Link clicks"
        value={summary.totalClicks.toLocaleString()}
        tone="action"
      />
      <StatTile
        icon={TrendingUp}
        label="Click rate"
        value={formatClickRate(summary.clickRate)}
        tone="action"
        hint="Clicks per view of /links. Over 100% just means the average visitor tapped more than one link."
      />
    </div>
  );
}
