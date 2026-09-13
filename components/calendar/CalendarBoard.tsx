"use client";

import { useMemo, useOptimistic, useRef, useState, useTransition } from "react";
import { DndContext, useDroppable, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { ArrowRight, CircleCheck } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { setContentStatus } from "@/app/calendar/actions";
import { cn } from "@/lib/utils";
import {
  PIPELINE_STAGES,
  movePostOnBoard,
  type BoardColumn,
  type BoardPost,
  type BoardTarget,
  type PipelineStage,
} from "@/lib/contentCalendar";
import type { CampaignBrandOption } from "@/lib/campaigns";
import type { EditorVideoOption } from "@/lib/contentPlan";
import type { Campaign } from "@/repositories/campaigns";
import type { ContentItem } from "@/repositories/contentPlan";
import { EditablePostCard, PostCardBody } from "./PostCard";
import { POST_TONES, STAGE_DOTS } from "./postTone";
import { StageFilter } from "./StageFilter";
import { CalendarDragOverlay, useCalendarSensors } from "./useScheduleDrag";

interface CalendarBoardProps {
  columns: BoardColumn[];
  contentItems?: ContentItem[];
  campaigns?: Campaign[];
  videoOptions?: EditorVideoOption[];
  brandOptions?: CampaignBrandOption[];
}

function badgeOf(post: BoardPost): string {
  return post.source === "campaign" ? "Deal" : post.detail;
}

function statusNote(post: BoardPost): string | undefined {
  return post.status.trim().toLowerCase() !== post.stage.toLowerCase() ? post.status : undefined;
}

function BoardColumnView({
  stage,
  count,
  hiddenOnPhone,
  children,
}: {
  stage: PipelineStage;
  count: number;
  /** Every column but the selected tab is hidden below lg. */
  hiddenOnPhone: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  return (
    <section
      ref={setNodeRef}
      aria-label={`${stage}: ${count}`}
      className={cn(
        "min-w-0 space-y-2 rounded-lg p-1 transition lg:border lg:bg-muted/30 lg:p-2",
        hiddenOnPhone && "hidden lg:block",
        isOver && "ring-2 ring-ring"
      )}
    >
      <header className="hidden items-center justify-between gap-2 px-0.5 pb-0.5 lg:flex">
        <span className="flex items-center gap-1.5 text-xs font-medium">
          <span className={cn("size-2 rounded-full", STAGE_DOTS[stage])} />
          {stage}
        </span>
        <span className="rounded-full bg-background px-1.5 py-0.5 text-[10px] leading-none font-medium tabular-nums text-muted-foreground ring-1 ring-border">
          {count}
        </span>
      </header>
      {count === 0 ? (
        <p className="rounded-lg border border-dashed px-2 py-6 text-center text-xs text-muted-foreground">
          {isOver ? "Drop to move here" : "Nothing at this stage"}
        </p>
      ) : (
        <div className="space-y-1.5">{children}</div>
      )}
    </section>
  );
}

// Everything live, by how far along it is, with no date axis at all: the view
// that answers "where are my ideas", undated ones included. The creator's own
// posts drag between columns to change stage, or move through their menu,
// which is the path on a phone where one column shows at a time. Deals stay
// put here and change stage from their edit sheet (see BoardPost.movable).
export function CalendarBoard({
  columns,
  contentItems = [],
  campaigns = [],
  videoOptions = [],
  brandOptions = [],
}: CalendarBoardProps) {
  const [board, applyMove] = useOptimistic(
    columns,
    (current, move: { postKey: string; target: BoardTarget }) =>
      movePostOnBoard(current, move.postKey, move.target)
  );
  const [, startTransition] = useTransition();
  const sensors = useCalendarSensors();
  const [activePost, setActivePost] = useState<BoardPost | null>(null);
  const justDragged = useRef(false);
  // The phone's open tab. Starts on the earliest stage with anything in it,
  // since an empty first tab reads as an empty board.
  const [tab, setTab] = useState<PipelineStage>(
    () => columns.find((column) => column.posts.length > 0)?.stage ?? PIPELINE_STAGES[0]
  );

  const counts = useMemo(
    () =>
      Object.fromEntries(board.map((column) => [column.stage, column.posts.length])) as Record<
        PipelineStage,
        number
      >,
    [board]
  );
  const contentById = useMemo(
    () => new Map(contentItems.map((item) => [item.id, item])),
    [contentItems]
  );
  const campaignById = useMemo(
    () => new Map(campaigns.map((campaign) => [campaign.id, campaign])),
    [campaigns]
  );

  // `current` is where the post is now, which for an undo is the target of the
  // move being undone rather than the stage the card was rendered with: a post
  // marked as posted has no column left to read it from.
  function moveTo(
    post: BoardPost,
    target: BoardTarget,
    { undoable = true, current = post.stage }: { undoable?: boolean; current?: BoardTarget } = {}
  ) {
    if (!post.movable || current === target) return;
    startTransition(async () => {
      applyMove({ postKey: post.key, target });
      const result = await setContentStatus(post.id, target);
      if (!result.success) {
        toast.error(`Couldn't move ${post.title}`, { description: result.error });
        return;
      }
      toast.success(
        target === "Posted" ? `${post.title} marked as posted` : `${post.title} moved to ${target}`,
        {
          action: undoable
            ? {
                label: "Undo",
                onClick: () => moveTo(post, current, { undoable: false, current: target }),
              }
            : undefined,
        }
      );
    });
  }

  function handleDragStart(event: DragStartEvent) {
    justDragged.current = true;
    setActivePost((event.active.data.current?.post as BoardPost | undefined) ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActivePost(null);
    setTimeout(() => {
      justDragged.current = false;
    });
    const post = event.active.data.current?.post as BoardPost | undefined;
    if (!post || !event.over) return;
    moveTo(post, String(event.over.id) as PipelineStage);
  }

  return (
    <DndContext
      id="calendar-board"
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActivePost(null);
        justDragged.current = false;
      }}
    >
      {/* Tabs on a phone, where one column is all that fits; hidden from lg,
          where every column is on screen with its own header. */}
      <StageFilter
        className="mb-2 lg:hidden"
        counts={counts}
        value={tab}
        onChange={(stage) => stage && setTab(stage)}
        clearable={false}
        countNoun="in production"
        aria-label="Stage"
      />

      <div className="lg:grid lg:grid-cols-5 lg:gap-2">
        {board.map((column) => (
          <BoardColumnView
            key={column.stage}
            stage={column.stage}
            count={column.posts.length}
            hiddenOnPhone={column.stage !== tab}
          >
            {column.posts.map((post) => (
              <EditablePostCard
                key={post.key}
                dragId={post.key}
                dragData={{ post }}
                draggable={post.movable}
                wasJustDragged={() => justDragged.current}
                item={post.source === "own" ? contentById.get(post.id) : undefined}
                campaign={post.source === "campaign" ? campaignById.get(post.id) : undefined}
                videoOptions={videoOptions}
                brandOptions={brandOptions}
                behind={post.behind}
                accentClassName={post.state ? POST_TONES[post.state].accent : undefined}
                menuLabel={`Move ${post.title} to another stage`}
                menu={
                  post.movable ? (
                    <>
                      <DropdownMenuLabel className="text-xs text-muted-foreground">
                        Move to
                      </DropdownMenuLabel>
                      {PIPELINE_STAGES.filter((stage) => stage !== post.stage).map((stage) => (
                        <DropdownMenuItem key={stage} onSelect={() => moveTo(post, stage)}>
                          <ArrowRight />
                          {stage}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => moveTo(post, "Posted")}>
                        <CircleCheck />
                        Mark as posted
                      </DropdownMenuItem>
                    </>
                  ) : undefined
                }
              >
                <PostCardBody
                  title={post.title}
                  badge={badgeOf(post)}
                  stage={post.stage}
                  statusNote={statusNote(post)}
                  label={post.label}
                  labelClassName={post.state ? POST_TONES[post.state].text : undefined}
                />
              </EditablePostCard>
            ))}
          </BoardColumnView>
        ))}
      </div>

      <CalendarDragOverlay>
        {activePost && (
          <div className="w-64 max-w-[80vw] cursor-grabbing rounded-md border bg-card p-2.5 shadow-lg">
            <PostCardBody
              title={activePost.title}
              badge={badgeOf(activePost)}
              stage={activePost.stage}
              label={activePost.label}
              labelClassName={activePost.state ? POST_TONES[activePost.state].text : undefined}
            />
          </div>
        )}
      </CalendarDragOverlay>
    </DndContext>
  );
}
