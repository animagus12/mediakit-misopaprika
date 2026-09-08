import { CalendarCheck, CalendarClock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { CampaignBrandOption } from "@/lib/campaigns";
import type { UnscheduledPost } from "@/lib/contentCalendar";
import type { EditorVideoOption } from "@/lib/contentPlan";
import type { Campaign } from "@/repositories/campaigns";
import type { ContentItem } from "@/repositories/contentPlan";
import { PostRow } from "./PostRow";

interface UnscheduledPostsCardProps {
  /** Undated deals and the ideas backlog, longest waiting first. */
  posts: UnscheduledPost[];
  /** The creator's own records by id, so an idea can be edited in place. */
  contentById: Map<string, ContentItem>;
  /** The undated deals themselves, so one can be edited in place too. */
  campaignById?: Map<string, Campaign>;
  /** Passed through to an own row's edit sheet. */
  videoOptions?: EditorVideoOption[];
  /** Passed through to a brand row's edit sheet. */
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
  if (post.ageDays === 1) return "Waiting 1 day";
  return `Waiting ${post.ageDays} days`;
}

// The other half of the calendar: work that is committed to but has no day
// yet, so it appears nowhere on the grid above. Deals and the creator's own
// ideas share one list because they raise the same question, and each row
// carries the date field that answers it: finding the record, opening its form
// and scrolling to a date field is the reason these sit undated.
export function UnscheduledPostsCard({
  posts,
  contentById,
  campaignById,
  videoOptions,
  brandOptions,
  className,
}: UnscheduledPostsCardProps) {
  if (posts.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
          <CalendarCheck className="size-5 text-muted-foreground" />
          <p className="text-sm font-medium">Everything has a day</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            New deals and anything you add without a date land here until you pick one.
          </p>
        </CardContent>
      </Card>
    );
  }

  const ideas = posts.filter((post) => post.source === "own").length;

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CalendarClock className="size-4 text-muted-foreground" />
          <CardDescription>Needs a date</CardDescription>
        </div>
        <CardTitle className="text-lg">
          {posts.length} not scheduled
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {ideas > 0 && `${ideas} of them yours · `}
            longest waiting first
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-0.5">
        {posts.map((post) => (
          <PostRow
            key={post.key}
            source={post.source}
            id={post.id}
            title={post.title}
            detail={post.detail}
            status={post.status}
            primaryMeta={waitingLabel(post)}
            metaClassName="text-muted-foreground"
            schedulable
            item={post.source === "own" ? contentById.get(post.id) : undefined}
            campaign={post.source === "campaign" ? campaignById?.get(post.id) : undefined}
            videoOptions={videoOptions}
            brandOptions={brandOptions}
          />
        ))}
      </CardContent>
    </Card>
  );
}
