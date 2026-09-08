"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatDayLabel } from "@/lib/day";
import type { CampaignBrandOption } from "@/lib/campaigns";
import type { ScheduledPost } from "@/lib/contentCalendar";
import type { EditorVideoOption } from "@/lib/contentPlan";
import type { Campaign } from "@/repositories/campaigns";
import type { ContentItem } from "@/repositories/contentPlan";
import { PostRow } from "./PostRow";
import { POST_TONES } from "./postTone";

interface DayPostsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** yyyy-mm-dd the sheet is showing, or "" while it has never been opened. */
  dayKey: string;
  /** Everything landing on that day, in the order the grid drew it. */
  posts: ScheduledPost[];
  /** The creator's own records by id, so a row can be edited in place. */
  contentById: Map<string, ContentItem>;
  /** The deals by id, so a brand row can be edited in place as well. */
  campaignById: Map<string, Campaign>;
  /** Passed through to an own row's edit sheet. */
  videoOptions?: EditorVideoOption[];
  /** Passed through to a brand row's edit sheet. */
  brandOptions?: CampaignBrandOption[];
  /** Opens the add form on this day, from the footer. */
  onAdd: (dayKey: string) => void;
}

// What is on one day, and everything that can be done to it.
//
// The grid can only ever be a few pixels of colour per post: a pill truncates
// on a desktop cell and collapses to a dot on a phone, so the cell says
// something is there without saying what, and offers no way to change it.
// This is the other half of that click. Rows are the same PostRow the lists
// below the grid use, which is what makes an entry editable from wherever it
// happens to be visible rather than only during the week it goes out.
export function DayPostsSheet({
  open,
  onOpenChange,
  dayKey,
  posts,
  contentById,
  campaignById,
  videoOptions,
  brandOptions,
  onAdd,
}: DayPostsSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="flex flex-col gap-0"
        // Without this the first row's date field takes focus on open, which
        // on a phone opens the OS date picker over a list the creator has not
        // read yet. Nothing here is a form to fill in, so the sheet itself
        // holds focus and the reader picks what to touch.
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <SheetHeader>
          <SheetTitle>{dayKey ? formatDayLabel(dayKey) : "This day"}</SheetTitle>
          <SheetDescription>
            {posts.length === 0
              ? "Nothing is on this day."
              : `${posts.length} post${posts.length === 1 ? "" : "s"} on this day.`}
          </SheetDescription>
        </SheetHeader>

        {/* The list is derived from the grid on every render, so moving a row
            to another day empties it out here rather than leaving a row that
            no longer belongs to the day in the title. */}
        <div className="flex-1 space-y-0.5 overflow-y-auto px-4">
          {posts.map((post) => (
            <PostRow
              key={post.key}
              source={post.source}
              id={post.id}
              title={post.title}
              detail={post.detail}
              status={post.status}
              // "Posted" is both the state and the status here, and the badge
              // already says it: this list is the one place the two can meet,
              // since the week-ahead list leaves posted work out entirely.
              primaryMeta={post.label === post.status ? "" : post.label}
              metaClassName={POST_TONES[post.state].text}
              behind={post.behind}
              schedulable
              currentIsoDate={post.dayKey}
              item={post.source === "own" ? contentById.get(post.id) : undefined}
              campaign={post.source === "campaign" ? campaignById.get(post.id) : undefined}
              videoOptions={videoOptions}
              brandOptions={brandOptions}
            />
          ))}
        </div>

        <SheetFooter>
          <Button type="button" variant="outline" onClick={() => onAdd(dayKey)}>
            <Plus />
            Add on this day
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
