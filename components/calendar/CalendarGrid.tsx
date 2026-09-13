"use client";

import { useMemo, useState } from "react";
import { DndContext, useDraggable, useDroppable } from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { WEEKDAY_LABELS, formatDayLabel } from "@/lib/day";
import { cn } from "@/lib/utils";
import { countStages } from "@/lib/contentCalendar";
import type {
  CalendarDay,
  CalendarPeriod,
  PipelineStage,
  ScheduledPost,
} from "@/lib/contentCalendar";
import type { CampaignBrandOption } from "@/lib/campaigns";
import type { EditorVideoOption } from "@/lib/contentPlan";
import type { Campaign } from "@/repositories/campaigns";
import type { ContentItem } from "@/repositories/contentPlan";
import { DayPostsSheet } from "./DayPostsSheet";
import { NewContentSheet } from "./NewContentSheet";
import { POST_TONES, STAGE_DOTS } from "./postTone";
import { StageFilter } from "./StageFilter";
import { CalendarDragOverlay, useScheduleDrag } from "./useScheduleDrag";

// How many pills fit in a cell before the rest collapse into a count. Four
// posts on one day is already an unusual day for a solo creator.
const MAX_PILLS = 3;

// The pill shows the headline and stage only, because a cell can be 40px wide;
// the rest of the row lives in the title so nothing is lost.
function postTitle(post: ScheduledPost): string {
  return [post.title, post.detail, post.status, post.label]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" · ");
}

function pillClass(post: ScheduledPost): string {
  const tone = POST_TONES[post.state];
  return post.source === "own" ? tone.pillOwn : tone.pill;
}

// An empty day adds; a day with something on it opens what is there. Spelled
// out here because the label a screen reader hears has to say which of the
// two the cell is about to do.
function cellLabel(day: CalendarDay): string {
  const when = formatDayLabel(day.key);
  if (day.posts.length === 0) return `Add content on ${when}`;
  return `${day.posts.length} post${day.posts.length === 1 ? "" : "s"} on ${when}`;
}

interface DayCellProps {
  day: CalendarDay;
  onSelect: (dayKey: string) => void;
  /** The stage picked in the filter, or null to show every post at full strength. */
  highlight: PipelineStage | null;
}

function DayCell({ day, onSelect, highlight }: DayCellProps) {
  const hidden = Math.max(0, day.posts.length - MAX_PILLS);
  const { setNodeRef, isOver } = useDroppable({ id: day.key });
  const dimmed = (post: ScheduledPost) => highlight !== null && post.stage !== highlight;
  // With a stage picked, its posts lead the cell, so one sitting fourth on a
  // busy day isn't the one folded into "+1 more". Stable otherwise, so the
  // grid keeps the server's order when nothing is picked.
  const posts = highlight
    ? [...day.posts.filter((post) => !dimmed(post)), ...day.posts.filter(dimmed)]
    : day.posts;

  return (
    // A div rather than the button it used to be: the pills inside are
    // draggable buttons of their own, and a button inside a button is invalid
    // markup that browsers flatten unpredictably. The cell's own click lives
    // on a button stretched underneath them instead.
    <div
      ref={setNodeRef}
      className={cn(
        // 7rem from sm up: each pill is two lines now that it carries its
        // stage, and a cell holding MAX_PILLS shouldn't grow its whole row.
        "group relative min-h-[3.5rem] p-1 transition sm:min-h-[7rem] sm:p-1.5",
        // Opaque on purpose: the hairlines are the grid's background showing
        // through a 1px gap, so a translucent cell lets the border colour
        // through its whole area and reads as a grey block. The neighbouring
        // months sit on the page ground, the month itself on the card.
        day.inPeriod ? "bg-card" : "bg-background",
        // A wash layered over the card rather than a translucent fill, for
        // the same reason.
        day.isToday && "bg-linear-to-b from-primary/12 to-primary/3",
        // The drop target, drawn on the cell rather than on the button under
        // it so it shows over the pills already there.
        isOver && "ring-2 ring-ring ring-inset"
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(day.key)}
        // The label carries the whole meaning of the control, because visually
        // the cell is just a date: a screen reader would otherwise announce
        // thirty-odd buttons called "10".
        aria-label={cellLabel(day)}
        // 56px tall, and as wide as a seventh of the screen allows: 45px at
        // 390px, 35px at 320px. The narrow case is under the 44px this project
        // holds its touch targets to, and cannot not be: seven columns is what
        // makes a month grid a month grid, and 7 x 44 does not fit a 320px
        // phone once the page and card have their padding. Same exception the
        // table-cell links took, and WCAG 2.5.8 (24px) still passes with room.
        className="absolute inset-0 cursor-pointer hover:bg-muted focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      />

      <div
        className={cn(
          "pointer-events-none relative flex items-center justify-between gap-1",
          !day.inPeriod && "opacity-50"
        )}
      >
        <span
          className={cn(
            "inline-flex size-5 items-center justify-center rounded-full text-[11px] tabular-nums",
            day.isToday && "bg-primary font-semibold text-primary-foreground",
            !day.isToday && !day.inPeriod && "text-muted-foreground/60",
            !day.isToday && day.inPeriod && "text-muted-foreground"
          )}
        >
          {day.dayOfMonth}
        </span>

        {/* Phone widths: a pill cannot be read in a 40px cell, so each post is
            a dot and tapping the day opens the list of them. A hollow dot is
            the creator's own, matching the outlined pill below. Dots don't
            drag: they are too small to grab, and the day sheet's date field
            moves a post just as well from a thumb. */}
        {day.posts.length > 0 && (
          <span className="flex items-center gap-0.5 sm:hidden">
            {posts.slice(0, MAX_PILLS).map((post) => (
              <span
                key={post.key}
                className={cn(
                  "size-1.5 rounded-full transition-opacity",
                  post.source === "own" ? POST_TONES[post.state].dotOwn : POST_TONES[post.state].dot,
                  dimmed(post) && "opacity-25"
                )}
              />
            ))}
          </span>
        )}

        {/* Desktop only, and only on a day with nothing on it: a pointer has
            hover to reveal this, a thumb does not, and a day that already has
            posts opens them rather than adding. */}
        {day.posts.length === 0 && (
          <Plus
            aria-hidden
            className="hidden size-3.5 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100 group-has-focus-visible:opacity-100 sm:block"
          />
        )}
      </div>

      <div
        className={cn(
          "pointer-events-none relative mt-1 hidden space-y-0.5 sm:block",
          !day.inPeriod && "opacity-60"
        )}
      >
        {posts.slice(0, MAX_PILLS).map((post) => (
          <DraggablePill
            key={post.key}
            post={post}
            dimmed={dimmed(post)}
            onSelect={() => onSelect(day.key)}
          />
        ))}
        {hidden > 0 && (
          <span className="block px-1 text-[10px] text-muted-foreground">+{hidden} more</span>
        )}
      </div>
    </div>
  );
}

// Title on top, stage underneath. The pill's colour already carries the state
// (missed, this week, later, posted), so the stage gets words and a dot from
// the stage ramp rather than a second colour competing with the first.
function Pill({ post, className }: { post: ScheduledPost; className?: string }) {
  return (
    <span
      className={cn(
        "flex min-w-0 flex-col rounded px-1 py-0.5 text-left leading-tight",
        pillClass(post),
        className
      )}
    >
      <span className="truncate text-[11px] font-medium">{post.title}</span>
      <span className="flex min-w-0 items-center gap-1 text-[10px] opacity-80">
        {post.stage && (
          <span className={cn("size-1.5 shrink-0 rounded-full", STAGE_DOTS[post.stage])} />
        )}
        <span className="truncate">{post.stage ?? "Posted"}</span>
      </span>
    </span>
  );
}

// A pill that can be picked up and dropped on another day. Clicking it without
// dragging opens its day, the same as clicking the cell around it: the
// sensors' activation constraints are what tell the two apart.
//
// Only the pointer listeners are spread, not dnd-kit's attributes: those
// announce "press space to pick up", and the grid registers no keyboard
// sensor. A keyboard user opens the day instead and moves the post with its
// date field, which is the more precise control anyway.
function DraggablePill({
  post,
  dimmed,
  onSelect,
}: {
  post: ScheduledPost;
  /** Faded behind the stage filter, but still draggable and clickable. */
  dimmed: boolean;
  onSelect: () => void;
}) {
  const { setNodeRef, listeners, isDragging } = useDraggable({ id: post.key, data: { post } });

  return (
    <button
      ref={setNodeRef}
      type="button"
      title={postTitle(post)}
      aria-label={`${postTitle(post)}. Drag to another day to move it.`}
      onClick={onSelect}
      {...listeners}
      className={cn(
        "pointer-events-auto block w-full cursor-grab touch-none rounded transition-opacity focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:cursor-grabbing",
        dimmed && "opacity-25 hover:opacity-60",
        // The original stays in place, faded, while the overlay follows the
        // pointer: the gap it would leave makes the cell jump under the drag.
        isDragging && "opacity-40"
      )}
    >
      <Pill post={post} />
    </button>
  );
}

// The interactive half of the month view: a day with nothing on it adds
// content there, a day with something on it opens what is there so it can be
// edited, moved or removed, and a pill dragged onto another day moves it
// there. One client component for the whole grid rather than one per cell, so
// there is a single pair of sheets and a single drag context on the page
// instead of eighty-four.
//
// `month` is already computed by the server (see buildCalendarMonth) and is
// plain data, so nothing about the calendar's rules crosses into the client.
export function CalendarGrid({
  month,
  contentItems = [],
  campaigns = [],
  videoOptions = [],
  brandOptions = [],
}: {
  month: CalendarPeriod;
  /** The creator's own records, so a row in the day sheet can be edited. */
  contentItems?: ContentItem[];
  /** The deals behind the brand rows, for the same reason. */
  campaigns?: Campaign[];
  videoOptions?: EditorVideoOption[];
  brandOptions?: CampaignBrandOption[];
}) {
  const drag = useScheduleDrag(month);
  const optimisticMonth = drag.period;
  const [highlight, setHighlight] = useState<PipelineStage | null>(null);
  // From the optimistic month, so a drag across the month's edge moves the
  // count with the pill instead of after the round trip.
  const stageCounts = useMemo(() => countStages(optimisticMonth), [optimisticMonth]);

  const [dayKey, setDayKey] = useState<string | null>(null);
  const [dayOpen, setDayOpen] = useState(false);
  const [addDate, setAddDate] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  // Keyed here rather than on the server, because a Map does not survive the
  // crossing into a client component: the rows are handed over as the arrays
  // they are stored as, the same way `month` is.
  const contentById = useMemo(
    () => new Map(contentItems.map((item) => [item.id, item])),
    [contentItems]
  );
  const campaignById = useMemo(
    () => new Map(campaigns.map((campaign) => [campaign.id, campaign])),
    [campaigns]
  );

  // Read back out of the month on every render rather than held as a
  // snapshot, so a write made from inside the sheet (a move, a delete) empties
  // the row out of the list under it as soon as the page revalidates.
  const selected = useMemo(() => {
    if (dayKey === null) return null;
    return optimisticMonth.weeks.flat().find((cell) => cell.key === dayKey) ?? null;
  }, [optimisticMonth, dayKey]);

  function openAdd(day: string) {
    setAddDate(day);
    setAddOpen(true);
  }

  function selectDay(day: string) {
    if (drag.wasJustDragged()) return;
    setDayKey(day);
    // A day with nothing on it has only one thing it can mean, so it skips
    // the list and goes straight to the form: the one-tap add the grid had
    // before it could open a day at all.
    const cell = optimisticMonth.weeks.flat().find((entry) => entry.key === day);
    if (!cell || cell.posts.length === 0) {
      openAdd(day);
      return;
    }
    setDayOpen(true);
  }

  return (
    <DndContext id="calendar-grid" {...drag.contextProps}>
      {/* The pipeline, read off the month in view: how much of what is
          scheduled here sits at each stage. Picking one fades everything else
          on the grid, which answers "what still has to be shot this month"
          without leaving the calendar; picking it again clears it. */}
      <StageFilter
        className="mb-2"
        counts={stageCounts}
        value={highlight}
        onChange={setHighlight}
        countNoun="this month"
        aria-label="Highlight posts at a stage"
      />

      {/* gap-px over a bordered background is what draws the hairlines: one
          rule per edge rather than doubled-up cell borders. */}
      <div className="overflow-hidden rounded-lg border border-border">
        <div className="grid grid-cols-7 gap-px bg-border">
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              className="bg-muted/50 py-1.5 text-center text-[10px] font-medium tracking-wide text-muted-foreground uppercase"
            >
              {/* One letter is all that fits at 320px; the full name returns
                  as soon as there is room for it. */}
              <span className="sm:hidden">{label.slice(0, 1)}</span>
              <span className="hidden sm:inline">{label}</span>
            </div>
          ))}
          {optimisticMonth.weeks.map((week) =>
            week.map((cell) => (
              <DayCell key={cell.key} day={cell} onSelect={selectDay} highlight={highlight} />
            ))
          )}
        </div>
      </div>

      <CalendarDragOverlay>
        {drag.activePost && (
          <Pill post={drag.activePost} className="w-32 cursor-grabbing bg-background shadow-md" />
        )}
      </CalendarDragOverlay>

      {/* Closing leaves `dayKey` alone so the exit animation is not cut short
          by a re-render; the next open overwrites it first. */}
      <DayPostsSheet
        open={dayOpen}
        onOpenChange={setDayOpen}
        dayKey={dayKey ?? ""}
        posts={selected?.posts ?? []}
        contentById={contentById}
        campaignById={campaignById}
        videoOptions={videoOptions}
        brandOptions={brandOptions}
        onAdd={openAdd}
      />

      <NewContentSheet
        open={addOpen}
        onOpenChange={setAddOpen}
        initialDate={addDate}
        videoOptions={videoOptions}
      />
    </DndContext>
  );
}
