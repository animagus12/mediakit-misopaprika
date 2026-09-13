"use client";

import { useTransition } from "react";
import {
  CalendarArrowDown,
  CalendarPlus,
  CalendarX2,
  MoreHorizontal,
  Sun,
  Sunrise,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { addDays, startOfWeek } from "@/lib/day";
import { cn } from "@/lib/utils";
import type { CampaignBrandOption } from "@/lib/campaigns";
import type { PipelineStage, PostSource } from "@/lib/contentCalendar";
import type { EditorVideoOption } from "@/lib/contentPlan";
import type { Campaign } from "@/repositories/campaigns";
import type { ContentItem } from "@/repositories/contentPlan";
import { PostEditSheet, StageSteps } from "./PostCard";
import { schedulePostWithToast } from "./useScheduleDrag";

interface QuickMove {
  label: string;
  icon: LucideIcon;
  toDayKey: string;
}

// The days worth one tap, relative to today rather than to the post: a post
// that was missed needs a day from now, not a day after the one it missed.
// Anything more precise is the date field in the edit sheet a tap opens.
function quickMoves(dayKey: string, today: string): QuickMove[] {
  const moves: QuickMove[] = [
    { label: "Today", icon: Sun, toDayKey: today },
    { label: "Tomorrow", icon: Sunrise, toDayKey: addDays(today, 1) },
  ];
  if (dayKey !== "" && dayKey >= today) {
    moves.push({ label: "A day later", icon: CalendarArrowDown, toDayKey: addDays(dayKey, 1) });
  }
  moves.push({
    label: "Next Monday",
    icon: CalendarPlus,
    toDayKey: addDays(startOfWeek(today), 7),
  });
  return moves.filter((move) => move.toDayKey !== dayKey);
}

interface PostListRowProps {
  source: PostSource;
  id: string;
  title: string;
  /** "Reel", or "Summer drop · 1 Reel · ₹6,685". */
  detail: string;
  stage: PipelineStage | null;
  /** The record's own status when the stage uses another word ("Todo"). */
  statusNote?: string;
  /** yyyy-mm-dd the post sits on, or "" when it has none. */
  dayKey: string;
  /** yyyy-mm-dd today, from the server's clock, so the quick picks agree with the page. */
  today: string;
  /** Right-hand label: "In 3 days", "Waiting 12 days". */
  meta: string;
  metaClassName?: string;
  /** A POST_TONES accent for the left edge. */
  accentClassName?: string;
  /** Close to its day and not ready. */
  behind?: boolean;
  item?: ContentItem;
  campaign?: Campaign;
  videoOptions?: EditorVideoOption[];
  brandOptions?: CampaignBrandOption[];
}

// One post in the Up next and Needs a date lists: a single line that opens
// the record on a tap, with a menu of days beside it.
//
// It replaced a row carrying a date field and an Edit button under every
// entry. Those made each row three controls tall, and the lists ran to a
// screen and a half of inputs; the date is one tap away in the sheet, and the
// common moves are one tap away in the menu.
export function PostListRow({
  source,
  id,
  title,
  detail,
  stage,
  statusNote,
  dayKey,
  today,
  meta,
  metaClassName,
  accentClassName,
  behind = false,
  item,
  campaign,
  videoOptions,
  brandOptions,
}: PostListRowProps) {
  const [isPending, startTransition] = useTransition();
  const post = { source, id, title };

  function moveTo(toDayKey: string, fromDayKey: string, undoable = true) {
    startTransition(async () => {
      await schedulePostWithToast(post, toDayKey, {
        undo: undoable ? () => moveTo(fromDayKey, toDayKey, false) : undefined,
      });
    });
  }

  const trigger = (
    <button
      type="button"
      className={cn(
        "flex w-full min-w-0 items-center gap-3 rounded-lg border border-l-[3px] bg-card py-2 pr-10 pl-3 text-left transition hover:border-foreground/20 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none pointer-coarse:pr-13",
        accentClassName ?? "border-l-border"
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm font-medium">{title}</span>
          {behind && (
            <Badge
              variant="outline"
              className="shrink-0 border-rose-500/30 bg-rose-500/10 text-[10px] text-rose-600 dark:text-rose-400"
            >
              Not ready
            </Badge>
          )}
        </span>
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <StageSteps stage={stage} />
          <span className="truncate">
            {stage ?? "Posted"}
            {statusNote && <span className="text-muted-foreground/70"> · {statusNote}</span>}
            {detail && <span className="text-muted-foreground/70"> · {detail}</span>}
          </span>
        </span>
      </span>
      <span
        className={cn(
          "shrink-0 text-right text-xs font-medium tabular-nums",
          metaClassName ?? "text-muted-foreground"
        )}
      >
        {meta}
      </span>
    </button>
  );

  return (
    <div className={cn("relative transition-opacity", isPending && "opacity-60")}>
      <PostEditSheet
        item={item}
        campaign={campaign}
        videoOptions={videoOptions}
        brandOptions={brandOptions}
        trigger={trigger}
      />
      <div className="absolute top-1/2 right-1.5 -translate-y-1/2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              disabled={isPending}
              aria-label={dayKey ? `Move ${title}` : `Schedule ${title}`}
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              {dayKey ? "Move to" : "Schedule for"}
            </DropdownMenuLabel>
            {quickMoves(dayKey, today).map((move) => (
              <DropdownMenuItem key={move.label} onSelect={() => moveTo(move.toDayKey, dayKey)}>
                <move.icon />
                {move.label}
              </DropdownMenuItem>
            ))}
            {dayKey && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => moveTo("", dayKey)}>
                  <CalendarX2 />
                  Remove date
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
