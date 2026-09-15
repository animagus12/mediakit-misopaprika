"use client";

import { useMemo, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  CalendarArrowDown,
  CalendarArrowUp,
  CalendarPlus,
  CalendarX2,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { WEEKDAY_LABELS, addDays } from "@/lib/day";
import { cn } from "@/lib/utils";
import { countStages, statusNoteOf } from "@/lib/contentCalendar";
import type {
  CalendarDay,
  PipelineStage,
  ScheduledPost,
} from "@/lib/contentCalendar";
import type { CampaignBrandOption } from "@/lib/campaigns";
import type { EditorVideoOption } from "@/lib/contentPlan";
import type { Campaign } from "@/repositories/campaigns";
import type { ContentItem } from "@/repositories/contentPlan";
import { NewContentSheet } from "./NewContentSheet";
import { EditablePostCard, PostCardBody } from "./PostCard";
import { POST_TONES } from "./postTone";
import { StageFilter } from "./StageFilter";
import { NeedsDateDragPreview } from "./NeedsDateRow";
import { CalendarDragOverlay, useScheduleDrag, type ScheduleDragData } from "./useScheduleDrag";

interface CalendarWeekViewProps {
  contentItems?: ContentItem[];
  campaigns?: Campaign[];
  videoOptions?: EditorVideoOption[];
  brandOptions?: CampaignBrandOption[];
}

function badgeOf(post: ScheduledPost): string {
  return post.source === "campaign" ? "Deal" : post.detail;
}


function WeekPostCard({
  post,
  item,
  campaign,
  videoOptions,
  brandOptions,
  dimmed,
  onMove,
  wasJustDragged,
}: {
  post: ScheduledPost;
  item?: ContentItem;
  campaign?: Campaign;
  videoOptions?: EditorVideoOption[];
  brandOptions?: CampaignBrandOption[];
  dimmed: boolean;
  onMove: (post: ScheduledPost, toDayKey: string) => void;
  wasJustDragged: () => boolean;
}) {
  return (
    <EditablePostCard
      dragId={post.key}
      dragData={{ kind: "scheduled", post } satisfies ScheduleDragData}
      draggable
      wasJustDragged={wasJustDragged}
      item={item}
      campaign={campaign}
      videoOptions={videoOptions}
      brandOptions={brandOptions}
      behind={post.behind}
      accentClassName={POST_TONES[post.state].accent}
      dimmed={dimmed}
      menuLabel={`Move ${post.title}`}
      menu={
        <>
          <DropdownMenuItem onSelect={() => onMove(post, addDays(post.dayKey, -1))}>
            <CalendarArrowUp />
            Day earlier
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onMove(post, addDays(post.dayKey, 1))}>
            <CalendarArrowDown />
            Day later
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onMove(post, addDays(post.dayKey, 7))}>
            <CalendarPlus />
            Next week
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => onMove(post, "")}>
            <CalendarX2 />
            Remove date
          </DropdownMenuItem>
        </>
      }
    >
      <PostCardBody
        title={post.title}
        badge={badgeOf(post)}
        status={post.status}
        stage={post.stage}
        statusNote={statusNoteOf(post)}
        // A posted card's stage line already says "Posted".
        label={post.state === "posted" ? "" : post.label}
        labelClassName={POST_TONES[post.state].text}
      />
    </EditablePostCard>
  );
}

function WeekDay({
  day,
  weekdayLabel,
  onAdd,
  children,
}: {
  day: CalendarDay;
  weekdayLabel: string;
  onAdd: (dayKey: string) => void;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: day.key });
  const empty = day.posts.length === 0;

  return (
    // A row per day at every width. Seven columns were tried on desktop and
    // gave each card about 150px, which truncated a title to its first letter:
    // rows keep a card readable, and the cards sit side by side once there is
    // room for more than one.
    <section
      ref={setNodeRef}
      aria-label={`${weekdayLabel} ${day.dayOfMonth}`}
      className={cn(
        "flex gap-3 rounded-lg border transition",
        // An empty day is one slim line: a quiet week otherwise spent seven
        // tall rows saying "Nothing planned", and pushed the lists off screen.
        empty ? "items-center px-2 py-1" : "p-2",
        day.isToday ? "border-primary/40 bg-primary/5" : !empty && "bg-muted/20",
        isOver && "ring-2 ring-ring"
      )}
    >
      <header
        className={cn(
          "flex w-10 shrink-0 items-center",
          empty ? "gap-1.5" : "flex-col pt-1"
        )}
      >
        <span
          className={cn(
            "text-[10px] font-medium tracking-wide uppercase",
            day.isToday ? "text-primary" : "text-muted-foreground"
          )}
        >
          {weekdayLabel}
        </span>
        <span
          className={cn(
            "inline-flex items-center justify-center rounded-full tabular-nums",
            empty ? "size-6 text-xs" : "size-7 text-sm",
            day.isToday && "bg-primary font-semibold text-primary-foreground"
          )}
        >
          {day.dayOfMonth}
        </span>
      </header>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {/* grid-cols-1 is not redundant: without a template the single column
            is sized to its content, and a long title that can't wrap then
            pushes the card out of the row instead of truncating. Tailwind's
            columns are minmax(0, 1fr), which lets the card shrink. */}
        {!empty && (
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
        )}
        {/* An empty day's add button fills the row, so there is a target to
            tap; a busy day's is a slim one under its cards. */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onAdd(day.key)}
          aria-label={`Add content on ${weekdayLabel} ${day.dayOfMonth}`}
          className={cn(
            "w-fit justify-start text-muted-foreground",
            empty && "h-8 w-full pointer-coarse:h-11"
          )}
        >
          <Plus />
          {empty ? "Nothing planned" : "Add"}
        </Button>
      </div>
    </section>
  );
}

// The week laid out in full: every post as a card with its stage, its day and
// everything that can be done to it, which the month grid has no room for on
// a phone. Cards drag between days (a hold on a touch screen), and each has a
// menu of moves as the dependable path on a small screen. The week and its
// drag context come from ScheduleDragProvider, shared with Needs a date.
export function CalendarWeekView({
  contentItems = [],
  campaigns = [],
  videoOptions = [],
  brandOptions = [],
}: CalendarWeekViewProps) {
  const drag = useScheduleDrag();
  const [highlight, setHighlight] = useState<PipelineStage | null>(null);
  const [addDate, setAddDate] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const stageCounts = useMemo(() => countStages(drag.period), [drag.period]);
  // Keyed here because a Map does not survive the crossing into a client
  // component, same as CalendarGrid.
  const contentById = useMemo(
    () => new Map(contentItems.map((item) => [item.id, item])),
    [contentItems]
  );
  const campaignById = useMemo(
    () => new Map(campaigns.map((campaign) => [campaign.id, campaign])),
    [campaigns]
  );

  function openAdd(dayKey: string) {
    setAddDate(dayKey);
    setAddOpen(true);
  }

  const days = drag.period.weeks[0] ?? [];

  return (
    <>
      <StageFilter
        className="mb-2"
        counts={stageCounts}
        value={highlight}
        onChange={setHighlight}
        countNoun="this week"
        aria-label="Highlight posts at a stage"
      />

      <div className="space-y-2">
        {days.map((day, index) => (
          <WeekDay key={day.key} day={day} weekdayLabel={WEEKDAY_LABELS[index]} onAdd={openAdd}>
            {day.posts.map((post) => (
              <WeekPostCard
                key={post.key}
                post={post}
                item={post.source === "own" ? contentById.get(post.id) : undefined}
                campaign={post.source === "campaign" ? campaignById.get(post.id) : undefined}
                videoOptions={videoOptions}
                brandOptions={brandOptions}
                dimmed={highlight !== null && post.stage !== highlight}
                onMove={drag.moveTo}
                wasJustDragged={drag.wasJustDragged}
              />
            ))}
          </WeekDay>
        ))}
      </div>

      <CalendarDragOverlay>
        {drag.active?.kind === "scheduled" && (
          <div className="w-72 max-w-[80vw] cursor-grabbing rounded-md border bg-card p-2.5 shadow-lg">
            <PostCardBody
              title={drag.active.post.title}
              badge={badgeOf(drag.active.post)}
              status={drag.active.post.status}
              stage={drag.active.post.stage}
              label={drag.active.post.label}
              labelClassName={POST_TONES[drag.active.post.state].text}
            />
          </div>
        )}
        {drag.active?.kind === "unscheduled" && <NeedsDateDragPreview post={drag.active.post} />}
      </CalendarDragOverlay>

      <NewContentSheet
        open={addOpen}
        onOpenChange={setAddOpen}
        initialDate={addDate}
        videoOptions={videoOptions}
      />
    </>
  );
}
