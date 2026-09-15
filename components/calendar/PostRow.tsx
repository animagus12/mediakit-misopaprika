import type { ReactNode } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { EditCampaignSheet } from "@/components/campaigns/EditCampaignSheet";
import type { CampaignBrandOption } from "@/lib/campaigns";
import type { PostSource } from "@/lib/contentCalendar";
import type { EditorVideoOption } from "@/lib/contentPlan";
import type { Campaign } from "@/repositories/campaigns";
import type { ContentItem } from "@/repositories/contentPlan";
import { EditContentSheet } from "./EditContentSheet";
import { SchedulePostControl } from "./SchedulePostControl";

// One row of either list, so the week-ahead reminders and the unscheduled
// backlog can't drift apart on layout, and both handle a brand deal and an own
// reel identically. A server component: the two controls it can render are
// their own client islands.

/** A post whose day is nearly here and whose work isn't finished. */
export const BEHIND_TONE = "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400";

interface PostRowProps {
  source: PostSource;
  id: string;
  title: string;
  detail: string;
  status: string;
  /**
   * Right-hand headline: "In 3 days", or "Waiting 12 days". Pass "" where it
   * would only repeat the status badge under it, as "Posted" does.
   */
  primaryMeta: string;
  /** Muted line under it: the date, or nothing. */
  secondaryMeta?: string;
  /** Tone for primaryMeta, from POST_TONES. */
  metaClassName?: string;
  /** Set for a row whose work isn't finished and whose day is nearly here. */
  behind?: boolean;
  /**
   * Renders the date field that schedules or moves the row. Off on the
   * dashboard, where the card is a pointer at the calendar rather than a
   * place to work.
   */
  schedulable?: boolean;
  /** yyyy-mm-dd currently stored, or "" when the row has no day yet. */
  currentIsoDate?: string;
  /** The full record behind an own row, so it can be edited in place. */
  item?: ContentItem;
  /**
   * The full record behind a brand row, so a deal can be edited without
   * leaving for /campaigns. It opens that page's own sheet rather than a
   * calendar-shaped subset of it: a deal's money, invoice, payment and
   * licence fields are the record, and a second form offering half of them
   * is the one that quietly disagrees with the first.
   */
  campaign?: Campaign;
  /**
   * The editing jobs, for whichever edit sheet the row opens: both a content
   * entry and a deal link to one.
   */
  videoOptions?: EditorVideoOption[];
  /** Passed to the campaign edit sheet, for its brand picker. */
  brandOptions?: CampaignBrandOption[];
  /**
   * A control that changes the status, shown at the row's end in place of the
   * status badge. The dashboard's week ahead passes one, so a post can be
   * moved along without leaving for the calendar.
   */
  statusControl?: ReactNode;
}

export function PostRow({
  source,
  id,
  title,
  detail,
  status,
  primaryMeta,
  secondaryMeta,
  metaClassName,
  behind = false,
  schedulable = false,
  currentIsoDate = "",
  item,
  campaign,
  videoOptions,
  brandOptions,
  statusControl,
}: PostRowProps) {
  // One affordance for both stores: which sheet it opens is the only thing
  // that differs, and a row that edits its own kind of record is the whole
  // point of the calendar being a place to work rather than a picture.
  const editTrigger = (
    <Button type="button" size="sm" variant="ghost">
      <Pencil />
      Edit
    </Button>
  );

  return (
    <div className={cn("rounded-md px-2 text-sm odd:bg-muted/30", statusControl ? "py-1.5" : "py-2")}>
      <div className={cn("flex gap-3", statusControl ? "items-center" : "items-start justify-between")}>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{title}</p>
          <p className="truncate text-xs text-muted-foreground">{detail || "-"}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end">
          {primaryMeta && <p className={cn("font-medium", metaClassName)}>{primaryMeta}</p>}
          <div className={cn("flex items-center gap-1.5", primaryMeta && !statusControl && "mt-1")}>
            {/* The status is the planner's whole point: "three reels this
                week" reads very differently when none of them are shot, so a
                row whose day is nearly here and whose work isn't finished
                says so in the status itself rather than in a separate icon.
                A row with a status control says it there instead. */}
            {!statusControl && (
              <Badge
                variant={behind ? "outline" : "secondary"}
                className={cn("text-[10px]", behind && BEHIND_TONE)}
              >
                {status}
              </Badge>
            )}
            {secondaryMeta && (
              <span className="text-xs tabular-nums text-muted-foreground">{secondaryMeta}</span>
            )}
          </div>
        </div>
        {statusControl && <div className="shrink-0">{statusControl}</div>}
      </div>

      {schedulable && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <SchedulePostControl
            // Keyed by the stored day so the field resets when the post is
            // moved from somewhere else on the page (a drag, a menu), rather
            // than holding the old date and offering a "Move" back to it.
            key={currentIsoDate}
            source={source}
            id={id}
            label={title}
            currentIsoDate={currentIsoDate}
          />
          {item && (
            <EditContentSheet item={item} videoOptions={videoOptions} trigger={editTrigger} />
          )}
          {campaign && (
            <EditCampaignSheet
              campaign={campaign}
              brandOptions={brandOptions}
              videoOptions={videoOptions}
              trigger={editTrigger}
            />
          )}
        </div>
      )}
    </div>
  );
}
