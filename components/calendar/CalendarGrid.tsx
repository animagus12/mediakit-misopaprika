"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { WEEKDAY_LABELS, formatDayLabel } from "@/lib/day";
import { cn } from "@/lib/utils";
import type { CalendarDay, CalendarMonth, ScheduledPost } from "@/lib/contentCalendar";
import { NewContentSheet } from "./NewContentSheet";
import type { EditorVideoOption } from "@/lib/contentPlan";
import { POST_TONES } from "./postTone";

// How many pills fit in a cell before the rest collapse into a count. Four
// posts on one day is already an unusual day for a solo creator.
const MAX_PILLS = 3;

// The pill shows the headline only, because a cell can be 40px wide; the rest
// of the row lives in the title so nothing is lost.
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

function DayCell({ day, onAdd }: { day: CalendarDay; onAdd: (dayKey: string) => void }) {
  const hidden = Math.max(0, day.posts.length - MAX_PILLS);

  return (
    <button
      type="button"
      onClick={() => onAdd(day.key)}
      // The label carries the whole meaning of the control, because visually
      // the cell is just a date: a screen reader would otherwise announce
      // thirty-odd buttons called "10".
      aria-label={`Add content on ${formatDayLabel(day.key)}`}
      // 56px tall, and as wide as a seventh of the screen allows: 45px at
      // 390px, 35px at 320px. The narrow case is under the 44px this project
      // holds its touch targets to, and cannot not be: seven columns is what
      // makes a month grid a month grid, and 7 x 44 does not fit a 320px
      // phone once the page and card have their padding. Same exception the
      // table-cell links took, and WCAG 2.5.8 (24px) still passes with room.
      className={cn(
        "group relative block min-h-[3.5rem] w-full cursor-pointer p-1 text-left transition sm:min-h-[6rem] sm:p-1.5",
        "hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:z-10",
        day.inMonth ? "bg-background" : "bg-muted/30"
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <span
          className={cn(
            "inline-flex size-5 items-center justify-center rounded-full text-[11px] tabular-nums",
            day.isToday && "bg-foreground font-semibold text-background",
            !day.isToday && !day.inMonth && "text-muted-foreground/60",
            !day.isToday && day.inMonth && "text-muted-foreground"
          )}
        >
          {day.dayOfMonth}
        </span>

        {/* Phone widths: a pill can't be read in a 40px cell, so each post is
            a dot and the detail lives in the lists below the grid. A hollow
            dot is the creator's own, matching the outlined pill below. */}
        {day.posts.length > 0 && (
          <span className="flex items-center gap-0.5 sm:hidden">
            {day.posts.slice(0, MAX_PILLS).map((post) => (
              <span
                key={post.key}
                className={cn(
                  "size-1.5 rounded-full",
                  post.source === "own" ? POST_TONES[post.state].dotOwn : POST_TONES[post.state].dot
                )}
              />
            ))}
          </span>
        )}

        {/* Desktop only: a pointer has hover to reveal this, a thumb doesn't,
            and on a phone the whole cell being tappable is the affordance. */}
        <Plus
          aria-hidden
          className="hidden size-3.5 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100 sm:block"
        />
      </div>

      <div className="mt-1 hidden space-y-0.5 sm:block">
        {day.posts.slice(0, MAX_PILLS).map((post) => (
          <span
            key={post.key}
            title={postTitle(post)}
            className={cn(
              "block truncate rounded px-1 py-0.5 text-[11px] leading-tight font-medium",
              pillClass(post)
            )}
          >
            {post.title}
          </span>
        ))}
        {hidden > 0 && (
          <span className="block px-1 text-[10px] text-muted-foreground">+{hidden} more</span>
        )}
      </div>
    </button>
  );
}

// The interactive half of the month view: every cell adds content on its own
// day. One client component for the whole grid rather than one per cell, so
// there is a single sheet on the page instead of forty-two.
//
// `month` is already computed by the server (see buildCalendarMonth) and is
// plain data, so nothing about the calendar's rules crosses into the client.
export function CalendarGrid({
  month,
  videoOptions = [],
}: {
  month: CalendarMonth;
  videoOptions?: EditorVideoOption[];
}) {
  const [day, setDay] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  function addOn(dayKey: string) {
    setDay(dayKey);
    setOpen(true);
  }

  return (
    <>
      {/* gap-px over a bordered background is what draws the hairlines: one
          rule per edge rather than doubled-up cell borders. */}
      <div className="overflow-hidden rounded-md border border-border">
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
          {month.weeks.map((week) =>
            week.map((cell) => <DayCell key={cell.key} day={cell} onAdd={addOn} />)
          )}
        </div>
      </div>

      {/* Closing leaves `day` alone so the exit animation isn't cut short by a
          re-render; the next open overwrites it before the form is reseeded. */}
      <NewContentSheet
        open={open}
        onOpenChange={setOpen}
        initialDate={day ?? ""}
        videoOptions={videoOptions}
      />
    </>
  );
}
