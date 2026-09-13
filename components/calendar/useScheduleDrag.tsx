"use client";

import {
  useOptimistic,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  DragOverlay,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DndContextProps,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";
import { schedulePost } from "@/app/calendar/actions";
import { formatDayLabel } from "@/lib/day";
import { movePostInPeriod } from "@/lib/contentCalendar";
import type { CalendarPeriod, ScheduledPost } from "@/lib/contentCalendar";

function subscribeNever(): () => void {
  return () => {};
}

/**
 * The input side of every drag on the calendar, shared by the board, the
 * month grid and the week so the three can't disagree about when a press
 * becomes a drag.
 *
 * A mouse drags after four pixels, so a click still opens what it lands on.
 * A finger has to hold for a quarter of a second first: a card fills the
 * width of a phone, and a drag that started on the first pixel of movement
 * would make the page impossible to scroll past one.
 */
export function useCalendarSensors() {
  return useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } })
  );
}

/**
 * Stops a press on a control inside a draggable card (its menu button) from
 * also picking the card up. dnd-kit's sensors listen for mousedown and
 * touchstart on the card, so those are the two events kept from reaching it.
 */
export const stopDragPropagation = {
  onMouseDown: (event: React.MouseEvent) => event.stopPropagation(),
  onTouchStart: (event: React.TouchEvent) => event.stopPropagation(),
};

/**
 * A drag overlay rendered into the body. The card and grid around a drag both
 * clip their overflow, and a card dragged past their edge would otherwise
 * vanish under them. Waits for hydration, since the server has no body to
 * portal into and a first client render that did would disagree with its HTML.
 */
export function CalendarDragOverlay({ children }: { children: ReactNode }) {
  const hydrated = useSyncExternalStore(subscribeNever, () => true, () => false);
  if (!hydrated) return null;
  return createPortal(<DragOverlay dropAnimation={null}>{children}</DragOverlay>, document.body);
}

/** What a toast needs to name a post and send it back. */
export type SchedulablePost = Pick<ScheduledPost, "source" | "id" | "title">;

/**
 * Writes a post's day through schedulePost and says so in a toast, with an
 * Undo when one is given. Every way of moving a post on the page (a drag, a
 * card menu, a list's quick pick) ends here, so they read and undo alike.
 * Resolves to whether the write landed.
 */
export async function schedulePostWithToast(
  post: SchedulablePost,
  toDayKey: string,
  { undo }: { undo?: () => void } = {}
): Promise<boolean> {
  const result = await schedulePost(post.source, post.id, toDayKey);
  if (!result.success) {
    toast.error(`Couldn't move ${post.title}`, { description: result.error });
    return false;
  }
  toast.success(
    toDayKey
      ? `${post.title} moved to ${formatDayLabel(toDayKey)}`
      : `${post.title} taken off the calendar`,
    {
      description: toDayKey ? undefined : "It's waiting under Needs a date.",
      action: undo ? { label: "Undo", onClick: undo } : undefined,
    }
  );
  return true;
}

interface MoveOptions {
  /** Offers an Undo in the toast. The undo itself is not undoable. */
  undoable?: boolean;
}

/**
 * Moving scheduled posts between days, for any view laid out in days.
 *
 * A move shows at once through useOptimistic and is replaced by the server's
 * render when the write lands. A failed write ends the transition without a
 * new render, and the optimistic period falls back to `period` on its own,
 * which is the undo a failed move needs.
 *
 * Every move writes through schedulePost, the action the date field uses, so
 * a drag, a menu pick and a typed date are one operation with one activity
 * entry.
 */
export function useScheduleDrag(period: CalendarPeriod) {
  const [optimisticPeriod, applyMove] = useOptimistic(
    period,
    (current, move: { postKey: string; toDayKey: string }) =>
      movePostInPeriod(current, move.postKey, move.toDayKey)
  );
  const [, startTransition] = useTransition();
  const [activePost, setActivePost] = useState<ScheduledPost | null>(null);
  // A drag that ends back over the element it started on still fires a click
  // there, which would open whatever that element opens the moment it is let
  // go.
  const justDragged = useRef(false);
  const sensors = useCalendarSensors();

  function moveTo(post: ScheduledPost, toDayKey: string, { undoable = true }: MoveOptions = {}) {
    if (post.dayKey === toDayKey) return;
    startTransition(async () => {
      applyMove({ postKey: post.key, toDayKey });
      await schedulePostWithToast(post, toDayKey, {
        undo: undoable
          ? () => moveTo({ ...post, dayKey: toDayKey }, post.dayKey, { undoable: false })
          : undefined,
      });
    });
  }

  function handleDragStart(event: DragStartEvent) {
    justDragged.current = true;
    setActivePost((event.active.data.current?.post as ScheduledPost | undefined) ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActivePost(null);
    // Cleared once the click the drop may have produced has been dispatched.
    setTimeout(() => {
      justDragged.current = false;
    });

    const post = event.active.data.current?.post as ScheduledPost | undefined;
    const toDayKey = event.over ? String(event.over.id) : null;
    if (!post || !toDayKey) return;
    moveTo(post, toDayKey);
  }

  function handleDragCancel() {
    setActivePost(null);
    justDragged.current = false;
  }

  const contextProps: DndContextProps = {
    sensors,
    collisionDetection: pointerWithin,
    onDragStart: handleDragStart,
    onDragEnd: handleDragEnd,
    onDragCancel: handleDragCancel,
  };

  return {
    period: optimisticPeriod,
    activePost,
    moveTo,
    contextProps,
    /** True for the click a drop produces, so a handler can ignore it. */
    wasJustDragged: () => justDragged.current,
  };
}
