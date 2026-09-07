import type { Metadata } from "next";
import Link from "next/link";
import { History } from "lucide-react";
import AppShell from "@/components/common/AppShell";
import { ActivityFeed } from "@/components/activity/ActivityFeed";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { activityFilters, resolveActivityFilter } from "@/lib/activity";
import { cn } from "@/lib/utils";
import { listActivities } from "@/repositories/activity.writer.server";

export const metadata: Metadata = {
  title: "Activity - @misopaprika",
  robots: { index: false, follow: false },
};

// An audit view is the one page that must never be served from cache: the
// creator opens it precisely to check whether the thing they just did landed.
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

interface ActivityPageProps {
  searchParams: Promise<{ type?: string; offset?: string }>;
}

function pageHref(filterId: string, offset: number): string {
  const params = new URLSearchParams();
  if (filterId !== "all") params.set("type", filterId);
  if (offset > 0) params.set("offset", String(offset));
  const query = params.toString();
  return query ? `/activity?${query}` : "/activity";
}

export default async function ActivityPage({ searchParams }: ActivityPageProps) {
  const { type, offset: offsetParam } = await searchParams;
  const filter = resolveActivityFilter(type);
  const parsedOffset = Number(offsetParam);
  const offset = Number.isFinite(parsedOffset) && parsedOffset > 0 ? Math.floor(parsedOffset) : 0;

  const { items, total, nextOffset } = await listActivities({
    offset,
    limit: PAGE_SIZE,
    types: filter.types,
  });

  return (
    <AppShell>
      {/* Narrower than the other pages' container on purpose. Those hold
          tables and card grids that use the width; this is a single column of
          sentences, and at 1440px the timestamp ends up an inch and a half
          from the row it belongs to. */}
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="mb-6 flex items-center justify-between gap-3">
          <h1 className="font-heading text-lg font-semibold">Activity</h1>
          {total > 0 && (
            <p className="text-xs text-muted-foreground">
              {total} event{total === 1 ? "" : "s"}
              {filter.id === "all" ? " on record" : ` in ${filter.label.toLowerCase()}`}
            </p>
          )}
        </div>

        <div className="mb-6 flex flex-wrap gap-1.5">
          {activityFilters.map((option) => (
            <Button
              key={option.id}
              asChild
              size="sm"
              variant={option.id === filter.id ? "secondary" : "ghost"}
              className={cn(option.id === filter.id && "font-medium")}
            >
              {/* Offset resets with the filter: page 3 of one view is not
                  page 3 of another. */}
              <Link href={pageHref(option.id, 0)}>{option.label}</Link>
            </Button>
          ))}
        </div>

        {items.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
              <History className="size-5 text-muted-foreground" />
              <p className="text-sm font-medium">
                {offset > 0 ? "Nothing further back" : "Nothing recorded yet"}
              </p>
              <p className="max-w-sm text-xs text-muted-foreground">
                {offset > 0
                  ? "The log holds the most recent 500 events."
                  : "Edits you make across the app land here: brands, campaigns, invoices, editing jobs, and anything you publish."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <ActivityFeed activities={items} />
        )}

        {(offset > 0 || nextOffset !== null) && (
          <div className="mt-8 flex items-center justify-between gap-2">
            {offset > 0 ? (
              <Button asChild size="sm" variant="outline">
                <Link href={pageHref(filter.id, Math.max(0, offset - PAGE_SIZE))}>Newer</Link>
              </Button>
            ) : (
              <span />
            )}
            {nextOffset !== null && (
              <Button asChild size="sm" variant="outline">
                <Link href={pageHref(filter.id, nextOffset)}>Older</Link>
              </Button>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
