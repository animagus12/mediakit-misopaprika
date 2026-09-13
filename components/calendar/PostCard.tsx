"use client";

import { MoreHorizontal } from "lucide-react";
import type { ReactElement, ReactNode } from "react";
import { useDraggable } from "@dnd-kit/core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EditCampaignSheet } from "@/components/campaigns/EditCampaignSheet";
import { cn } from "@/lib/utils";
import { PIPELINE_STAGES, stageStep, type PipelineStage } from "@/lib/contentCalendar";
import type { CampaignBrandOption } from "@/lib/campaigns";
import type { EditorVideoOption } from "@/lib/contentPlan";
import type { Campaign } from "@/repositories/campaigns";
import type { ContentItem } from "@/repositories/contentPlan";
import { EditContentSheet } from "./EditContentSheet";
import { stopDragPropagation } from "./useScheduleDrag";

/**
 * How far along a post is, as five dots filled up to its stage.
 *
 * Position rather than colour: on a phone a tint is hard to tell apart at a
 * glance, but "three of five" reads instantly. Ready and Posted fill green,
 * since both mean there is nothing left to make.
 */
export function StageSteps({ stage }: { stage: PipelineStage | null }) {
  const step = stage ? stageStep(stage) : PIPELINE_STAGES.length;
  const done = stage === null || stage === "Ready";
  return (
    <span className="flex items-center gap-0.5" aria-hidden>
      {PIPELINE_STAGES.map((entry, index) => (
        <span
          key={entry}
          className={cn(
            "size-1.5 rounded-full",
            index < step
              ? done
                ? "bg-emerald-500"
                : "bg-foreground/70"
              : "bg-muted-foreground/25"
          )}
        />
      ))}
    </span>
  );
}

interface PostCardBodyProps {
  title: string;
  /** "Deal" for a brand deal, the format for an own post. */
  badge: string;
  stage: PipelineStage | null;
  /** The record's own status when it isn't the stage's name ("Todo"). */
  statusNote?: string;
  /** "In 3 days", "Overdue by 1 day", "No date". */
  label: string;
  labelClassName?: string;
}

/** What a card says, independent of how it is dragged or opened. */
export function PostCardBody({
  title,
  badge,
  stage,
  statusNote,
  label,
  labelClassName,
}: PostCardBodyProps) {
  return (
    <span className="flex min-w-0 flex-col gap-1.5">
      {/* Two lines before truncating: a board column is about 150px wide, and
          one line with a badge beside it cut titles to "Manhwa Re...". The
          badge moved down to the stage line so the title has the whole row. */}
      <span className="line-clamp-2 text-sm leading-snug font-medium break-words">{title}</span>
      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <Badge variant="secondary" className="text-[10px]">
          {badge}
        </Badge>
        <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
          <StageSteps stage={stage} />
          <span className="truncate">
            {stage ?? "Posted"}
            {statusNote && <span className="text-muted-foreground/70"> · {statusNote}</span>}
          </span>
        </span>
        <span
          className={cn("ml-auto shrink-0 tabular-nums", labelClassName ?? "text-muted-foreground")}
        >
          {label}
        </span>
      </span>
    </span>
  );
}

interface PostEditSheetProps {
  /** The creator's own record behind the post, when it is one. */
  item?: ContentItem;
  /** The deal behind the post, when it is one. */
  campaign?: Campaign;
  videoOptions?: EditorVideoOption[];
  brandOptions?: CampaignBrandOption[];
  /** Rendered bare when there is no record to edit. */
  trigger: ReactElement;
}

/**
 * Wraps a trigger in whichever edit sheet the post's store uses. Every card
 * and list row on the calendar opens its record this way, so a tap means the
 * same thing wherever a post is shown.
 */
export function PostEditSheet({
  item,
  campaign,
  videoOptions,
  brandOptions,
  trigger,
}: PostEditSheetProps) {
  if (item) return <EditContentSheet item={item} videoOptions={videoOptions} trigger={trigger} />;
  if (campaign) {
    return (
      <EditCampaignSheet
        campaign={campaign}
        brandOptions={brandOptions}
        videoOptions={videoOptions}
        trigger={trigger}
      />
    );
  }
  return trigger;
}

interface EditablePostCardProps {
  /** Unique across the drag context. */
  dragId: string;
  /** Handed back on drop, as `active.data.current`. */
  dragData: Record<string, unknown>;
  draggable: boolean;
  /** Set for the click a drop produces, so it doesn't open the sheet. */
  wasJustDragged: () => boolean;
  item?: ContentItem;
  campaign?: Campaign;
  videoOptions?: EditorVideoOption[];
  brandOptions?: CampaignBrandOption[];
  /** DropdownMenuItems for the card's menu. Omit for a card with no menu. */
  menu?: ReactNode;
  menuLabel?: string;
  /** A POST_TONES accent for the card's left edge, or none for an undated post. */
  accentClassName?: string;
  behind?: boolean;
  dimmed?: boolean;
  children: ReactNode;
}

// A post as a card that opens its edit sheet on a tap, can be dragged, and can
// carry a menu of moves: the week and the board both lay posts out this way.
//
// The menu is a sibling of the card's button, not a child of it, because a
// button inside a button is invalid markup. It is the phone's way to move a
// card: a long press drags, but a menu is the reliable path on a small screen.
export function EditablePostCard({
  dragId,
  dragData,
  draggable,
  wasJustDragged,
  item,
  campaign,
  videoOptions,
  brandOptions,
  menu,
  menuLabel = "Move",
  accentClassName,
  behind = false,
  dimmed = false,
  children,
}: EditablePostCardProps) {
  const { setNodeRef, listeners, isDragging } = useDraggable({
    id: dragId,
    data: dragData,
    disabled: !draggable,
  });

  const trigger = (
    <button
      type="button"
      onClick={(event) => {
        // A prevented click is ignored by the sheet's trigger.
        if (wasJustDragged()) event.preventDefault();
      }}
      className={cn(
        "block w-full rounded-lg border border-l-[3px] bg-card p-2.5 text-left shadow-xs transition hover:border-foreground/20 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        accentClassName ?? "border-l-border",
        menu && "pr-9 pointer-coarse:pr-12",
        behind && "bg-rose-500/5"
      )}
    >
      {children}
    </button>
  );

  return (
    <div
      ref={setNodeRef}
      {...(draggable ? listeners : {})}
      className={cn(
        // min-w-0 so a card inside a grid or flex track can shrink below its
        // title's full width, and the title truncates rather than overflowing.
        "relative min-w-0 select-none transition-opacity",
        // manipulation, not none: the page must still scroll when a thumb
        // starts on a card. The touch sensor's hold delay is what separates
        // a scroll from a drag.
        draggable && "cursor-grab touch-manipulation active:cursor-grabbing",
        dimmed && "opacity-30 hover:opacity-70",
        isDragging && "opacity-40"
      )}
    >
      <PostEditSheet
        item={item}
        campaign={campaign}
        videoOptions={videoOptions}
        brandOptions={brandOptions}
        trigger={trigger}
      />

      {menu && (
        <div className="absolute top-1.5 right-1.5" {...stopDragPropagation}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" size="icon-sm" variant="ghost" aria-label={menuLabel}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {menu}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}
