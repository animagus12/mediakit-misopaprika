import { CalendarCheck, CalendarClock, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { CampaignBrandOption } from "@/lib/campaigns";
import type { UnscheduledPost } from "@/lib/contentCalendar";
import type { EditorVideoOption } from "@/lib/contentPlan";
import type { Campaign } from "@/repositories/campaigns";
import type { ContentItem } from "@/repositories/contentPlan";
import { PostListRow } from "./PostListRow";

// Enough to see what has waited longest without the card outgrowing Up next
// beside it. The rest are a tap away, and all of them are on the Board.
const VISIBLE_ROWS = 6;

// A wait long enough to be worth colour: a month without a day is a deal
// quietly going stale.
const STALE_DAYS = 30;

interface NeedsDateCardProps {
  /** Undated deals and the ideas backlog, longest waiting first. */
  posts: UnscheduledPost[];
  /** yyyy-mm-dd today, for the rows' quick picks. */
  today: string;
  contentById: Map<string, ContentItem>;
  campaignById: Map<string, Campaign>;
  videoOptions?: EditorVideoOption[];
  brandOptions?: CampaignBrandOption[];
  className?: string;
}

// How long something has gone without a day. For a deal that is measured from
// the deal date, for an idea from when it was written down: how long ago the
// creator committed to it is the only clock either has, and it is the right
// one.
function waitingLabel(post: UnscheduledPost): string {
  if (post.ageDays === null || post.ageDays < 0) return "No date";
  if (post.ageDays === 0) return post.source === "own" ? "Added today" : "Agreed today";
  return `${post.ageDays}d waiting`;
}

// Work that is committed to but has no day yet, so it appears on neither the
// month nor the week. Deals and the creator's own ideas share one list because
// they raise the same question, and each row's menu answers it in a tap.
export function NeedsDateCard({
  posts,
  today,
  contentById,
  campaignById,
  videoOptions,
  brandOptions,
  className,
}: NeedsDateCardProps) {
  const deals = posts.filter((post) => post.source === "campaign").length;

  const row = (post: UnscheduledPost) => (
    <PostListRow
      key={post.key}
      source={post.source}
      id={post.id}
      title={post.title}
      detail={post.detail}
      stage={post.stage}
      statusNote={
        post.status.trim().toLowerCase() !== post.stage.toLowerCase() ? post.status : undefined
      }
      dayKey=""
      today={today}
      meta={waitingLabel(post)}
      metaClassName={
        (post.ageDays ?? 0) >= STALE_DAYS ? "text-amber-600 dark:text-amber-400" : undefined
      }
      // Deals get the edge: they have a brand waiting on the date.
      accentClassName={post.source === "campaign" ? "border-l-sky-500" : undefined}
      item={post.source === "own" ? contentById.get(post.id) : undefined}
      campaign={post.source === "campaign" ? campaignById.get(post.id) : undefined}
      videoOptions={videoOptions}
      brandOptions={brandOptions}
    />
  );

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CalendarClock className="size-4 text-sky-600 dark:text-sky-400" />
          <CardTitle className="text-base">Needs a date</CardTitle>
        </div>
        <CardDescription>
          {posts.length === 0
            ? "Undated deals and ideas land here"
            : [
                `${posts.length} not scheduled`,
                deals > 0 ? `${deals} brand deal${deals === 1 ? "" : "s"}` : null,
                "longest waiting first",
              ]
                .filter(Boolean)
                .join(" · ")}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {posts.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-8 text-center">
            <CalendarCheck className="size-5 text-emerald-600 dark:text-emerald-400" />
            <p className="text-sm font-medium">Everything has a day</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              New deals and anything you add without a date land here until you pick one.
            </p>
          </div>
        ) : (
          <Collapsible className="group/more space-y-1.5">
            {posts.slice(0, VISIBLE_ROWS).map(row)}
            {posts.length > VISIBLE_ROWS && (
              <>
                <CollapsibleContent className="space-y-1.5">
                  {posts.slice(VISIBLE_ROWS).map(row)}
                </CollapsibleContent>
                <CollapsibleTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full text-muted-foreground"
                  >
                    {/* Swapped by the open state in CSS, so this stays a
                        server component with no state of its own. */}
                    <span className="group-data-[state=open]/more:hidden">
                      Show {posts.length - VISIBLE_ROWS} more
                    </span>
                    <span className="hidden group-data-[state=open]/more:inline">Show less</span>
                    <ChevronDown className="transition-transform group-data-[state=open]/more:rotate-180" />
                  </Button>
                </CollapsibleTrigger>
              </>
            )}
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
