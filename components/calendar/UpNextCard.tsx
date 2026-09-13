import { AlarmClock, CalendarCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { WEEK_AHEAD_DAYS, type AgendaGroup, type ScheduledPost } from "@/lib/contentCalendar";
import type { CampaignBrandOption } from "@/lib/campaigns";
import type { EditorVideoOption } from "@/lib/contentPlan";
import type { Campaign } from "@/repositories/campaigns";
import type { ContentItem } from "@/repositories/contentPlan";
import { PostListRow } from "./PostListRow";
import { POST_TONES } from "./postTone";

interface UpNextCardProps {
  /** selectWeekAhead's posts, grouped by groupAgenda. */
  groups: AgendaGroup[];
  /** yyyy-mm-dd today, for the rows' quick picks. */
  today: string;
  contentById: Map<string, ContentItem>;
  campaignById: Map<string, Campaign>;
  videoOptions?: EditorVideoOption[];
  brandOptions?: CampaignBrandOption[];
  className?: string;
}

// A deal's own status, when the stage it is filed under uses another word.
function statusNote(post: ScheduledPost): string | undefined {
  return post.stage && post.status.trim().toLowerCase() !== post.stage.toLowerCase()
    ? post.status
    : undefined;
}

// Under a day heading the day is already said, so a row repeats nothing. A
// missed post's heading names no day, so its row carries how late it is.
function rowMeta(group: AgendaGroup, post: ScheduledPost): string {
  return group.missed ? `${Math.abs(post.daysAway)}d late` : "";
}

// The reminder the calendar exists for, as an agenda: missed work first, then
// each of the next WEEK_AHEAD_DAYS days that has something on it, under its
// own heading. The Week view shows one Monday-to-Sunday week; this list rolls
// with today, so on a Saturday it still shows what goes out on Monday.
export function UpNextCard({
  groups,
  today,
  contentById,
  campaignById,
  videoOptions,
  brandOptions,
  className,
}: UpNextCardProps) {
  const posts = groups.flatMap((group) => group.posts);
  const behind = posts.filter((post) => post.behind).length;

  return (
    // scroll-mt so the Missed tile's link lands with the heading clear of the
    // app bar.
    <Card id="up-next" className={cn("scroll-mt-20", className)}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlarmClock className="size-4 text-amber-600 dark:text-amber-400" />
          <CardTitle className="text-base">Up next</CardTitle>
        </div>
        <CardDescription>
          {posts.length === 0
            ? `Missed work and the next ${WEEK_AHEAD_DAYS} days`
            : [`${posts.length} to publish`, behind > 0 ? `${behind} not ready` : null]
                .filter(Boolean)
                .join(" · ")}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {groups.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-8 text-center">
            <CalendarCheck className="size-5 text-emerald-600 dark:text-emerald-400" />
            <p className="text-sm font-medium">All caught up</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              Nothing is due in the next {WEEK_AHEAD_DAYS} days, and nothing earlier is still
              waiting to go out.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <section key={group.key} aria-label={group.label} className="space-y-1.5">
                <h3 className="flex items-center gap-2 text-[11px] font-medium tracking-wide uppercase">
                  <span
                    className={cn(
                      group.missed
                        ? "text-rose-600 dark:text-rose-400"
                        : group.label === "Today"
                          ? "text-primary"
                          : "text-muted-foreground"
                    )}
                  >
                    {group.label}
                  </span>
                  {group.date && (
                    <span className="font-normal tracking-normal text-muted-foreground normal-case">
                      {group.date}
                    </span>
                  )}
                  <span aria-hidden className="h-px flex-1 bg-border" />
                </h3>
                {group.posts.map((post) => (
                  <PostListRow
                    key={post.key}
                    source={post.source}
                    id={post.id}
                    title={post.title}
                    detail={post.detail}
                    stage={post.stage}
                    statusNote={statusNote(post)}
                    dayKey={post.dayKey}
                    today={today}
                    meta={rowMeta(group, post)}
                    metaClassName={POST_TONES[post.state].text}
                    accentClassName={POST_TONES[post.state].accent}
                    behind={post.behind}
                    item={post.source === "own" ? contentById.get(post.id) : undefined}
                    campaign={post.source === "campaign" ? campaignById.get(post.id) : undefined}
                    videoOptions={videoOptions}
                    brandOptions={brandOptions}
                  />
                ))}
              </section>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
