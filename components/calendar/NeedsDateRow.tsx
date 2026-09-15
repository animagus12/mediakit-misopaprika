"use client";

import type { ComponentProps } from "react";
import { useDraggable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import type { UnscheduledPost } from "@/lib/contentCalendar";
import { PostCardBody } from "./PostCard";
import { PostListRow } from "./PostListRow";
import { useOptionalScheduleDrag, type ScheduleDragData } from "./useScheduleDrag";

type NeedsDateRowProps = Omit<ComponentProps<typeof PostListRow>, "wasJustDragged"> & {
  post: UnscheduledPost;
};

// A Needs a date row that can be picked up and dropped on a day in the month
// or week above it. Outside a date view (the board) it is a plain row.
//
// The row stays in its list, faded, while the overlay follows the pointer, and
// leaves the list the moment it is dropped rather than after the round trip.
export function NeedsDateRow({ post, ...rowProps }: NeedsDateRowProps) {
  const drag = useOptionalScheduleDrag();
  const data: ScheduleDragData = { kind: "unscheduled", post };
  const { setNodeRef, listeners, isDragging } = useDraggable({
    id: post.key,
    data,
    disabled: !drag,
  });

  if (drag?.isPlaced(post.key)) return null;

  return (
    <div
      ref={setNodeRef}
      {...(drag ? listeners : {})}
      className={cn(
        "min-w-0 select-none transition-opacity",
        // manipulation, not none: the list must still scroll under a thumb.
        // The touch sensor's hold delay is what separates a scroll from a drag.
        drag && "cursor-grab touch-manipulation active:cursor-grabbing",
        isDragging && "opacity-40"
      )}
    >
      <PostListRow {...rowProps} wasJustDragged={drag?.wasJustDragged} />
    </div>
  );
}

/** What follows the pointer while an undated post is dragged onto a day. */
export function NeedsDateDragPreview({ post }: { post: UnscheduledPost }) {
  return (
    <div
      className={cn(
        "w-56 max-w-[80vw] cursor-grabbing rounded-md border border-l-[3px] bg-card p-2.5 shadow-lg",
        post.source === "campaign" ? "border-l-sky-500" : "border-l-border"
      )}
    >
      <PostCardBody
        title={post.title}
        badge={post.source === "campaign" ? "Deal" : post.detail}
        status={post.status}
        stage={post.stage}
        label="No date"
      />
    </div>
  );
}
