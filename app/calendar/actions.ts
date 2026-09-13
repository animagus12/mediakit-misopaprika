"use server";

import { campaignRepository } from "@/repositories/campaignRepository";
import {
  addContentItem,
  deleteContentItem as removeContentItem,
  setContentItemDate,
  setContentItemStatus,
  updateContentItem as writeContentItem,
} from "@/repositories/contentPlan.writer.server";
import { recordActivity } from "@/repositories/activity.writer.server";
import { revalidateStores } from "@/lib/revalidation";
import { campaignLabel, toIsoDate, toSheetDate } from "@/lib/campaigns";
import {
  contentLabel,
  isContentFormat,
  isContentStatus,
  type ContentFormValues,
} from "@/lib/contentPlan";
import { describeChanges } from "@/lib/activityDiff";
import { contentFields } from "@/lib/activityFields";
import { formatDayLabel, isDayKey } from "@/lib/day";
import type { RecordChange } from "@/lib/activityDiff";
import type { ActivityAction } from "@/repositories/activity";
import type { ContentItemRecord } from "@/repositories/contentPlan";
import type { PostSource } from "@/lib/contentCalendar";

export type CalendarResult = { success: true } | { success: false; error: string };

function failure(err: unknown, fallback: string): CalendarResult {
  return { success: false, error: err instanceof Error ? err.message : fallback };
}

// The date vocabulary shared by every action here: "" clears the day,
// anything else is one. A Server Action is reachable by direct POST rather
// than only through the control that calls it, so the shape is checked rather
// than trusted from the <input type="date"> that produced it. The session is
// not checked here for the same reason the other actions in this app don't:
// the proxy guards /calendar, and an action posts to the page's own route.
function invalidDate(isoDate: string): string | null {
  return isoDate === "" || isDayKey(isoDate) ? null : "That isn't a valid date";
}

// What a scheduling event says, and which of the two events it is. Read from
// the record either side of the write rather than from the input, so setting a
// day to the one it already held logs nothing at all instead of a row claiming
// something moved when it didn't.
function describeMove(
  before: string,
  after: string,
  scheduled: ActivityAction,
  unscheduled: ActivityAction
): { action: ActivityAction; detail: string } | null {
  if (before === after) return null;

  const from = toIsoDate(before);
  const to = toIsoDate(after);

  if (to === "") {
    return { action: unscheduled, detail: from === "" ? "" : `was ${formatDayLabel(from)}` };
  }
  return {
    action: scheduled,
    detail: from === "" ? formatDayLabel(to) : `${formatDayLabel(from)} to ${formatDayLabel(to)}`,
  };
}

/**
 * Puts a post on a day, moves it, or takes it back off (`isoDate` "").
 *
 * Writes only the posting day: everything else on the record is left exactly
 * as it was, which is what makes this safe to fire from a row in a list rather
 * than from a form. `source` decides which store is written, so one control
 * serves both a brand deal and an own reel.
 */
export async function schedulePost(
  source: PostSource,
  id: string,
  isoDate: string
): Promise<CalendarResult> {
  const invalid = invalidDate(isoDate);
  if (invalid) return { success: false, error: invalid };
  const stored = isoDate ? toSheetDate(isoDate) : "";

  try {
    if (source === "campaign") {
      const change = await campaignRepository.schedulePost(id, isoDate);
      if (!change) return { success: false, error: "That campaign no longer exists" };
      revalidateStores("campaigns");

      const move = describeMove(
        change.before.uploadDate,
        change.after.uploadDate,
        "campaign.scheduled",
        "campaign.unscheduled"
      );
      if (move) {
        await recordActivity({
          action: move.action,
          entity: {
            type: "campaign",
            id: change.after.id,
            label: campaignLabel(change.after.campaign, change.after.brand),
          },
          detail: move.detail || undefined,
        });
      }
      return { success: true };
    }

    const change = await setContentItemDate(id, stored);
    if (!change) return { success: false, error: "That entry no longer exists" };
    revalidateStores("contentPlan");

    const move = describeMove(
      change.before.postDate,
      change.after.postDate,
      "content.scheduled",
      "content.unscheduled"
    );
    if (move) {
      await recordActivity({
        action: move.action,
        entity: { type: "content", id: change.after.id, label: contentLabel(change.after.title) },
        detail: move.detail || undefined,
      });
    }
    return { success: true };
  } catch (err) {
    return failure(err, "Couldn't save the posting date");
  }
}

/**
 * Moves one of the creator's own posts to another production status: the
 * board's drag between stages, and its "Move to" menu.
 *
 * Writes only the status, like schedulePost writes only the day. Deals are
 * not accepted: a stage does not map back to one campaign status, so a deal
 * changes stage from its own edit sheet (see BoardPost.movable).
 */
export async function setContentStatus(id: string, status: string): Promise<CalendarResult> {
  if (!isContentStatus(status)) return { success: false, error: "Pick a status" };

  try {
    const change = await setContentItemStatus(id, status);
    if (!change) return { success: false, error: "That entry no longer exists" };
    revalidateStores("contentPlan");

    const detail = describeChanges(change, contentFields);
    // Setting the status it already had is a no-op, and logs nothing, for
    // the same reason a move to the same day doesn't.
    if (detail) {
      await recordActivity({
        action: "content.updated",
        entity: { type: "content", id: change.after.id, label: contentLabel(change.after.title) },
        detail,
      });
    }
    return { success: true };
  } catch (err) {
    return failure(err, "Couldn't save the status");
  }
}

// The title is deliberately not required: "something on Friday" is a real
// plan, and contentLabel gives it a stand-in. The two closed unions are, since
// an off-list value would render as a blank badge and break the status
// ordering everything else depends on.
function invalidContent(input: ContentFormValues): string | null {
  if (!isContentFormat(input.format)) return "Pick a format";
  if (!isContentStatus(input.status)) return "Pick a status";
  return invalidDate(input.postDate);
}

// The link is stored but never read back through, so a stale id (its editing
// job since deleted) costs nothing beyond the picker showing one fewer match.
// It is therefore sanitised rather than checked against the store, which would
// mean an extra read on every write to guard against nothing.
function linkedVideoId(value: string | null): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

export async function createContentItem(input: ContentFormValues): Promise<CalendarResult> {
  const invalid = invalidContent(input);
  if (invalid) return { success: false, error: invalid };

  try {
    const record = await addContentItem({
      title: input.title,
      format: input.format,
      status: input.status,
      postDate: input.postDate ? toSheetDate(input.postDate) : "",
      notes: input.notes,
      editorTransactionId: linkedVideoId(input.editorTransactionId),
    });
    revalidateStores("contentPlan");
    await recordActivity({
      action: "content.created",
      entity: { type: "content", id: record.id, label: contentLabel(record.title) },
      // The format alone is thin; the day is what makes the row worth reading
      // back later, and an idea with no day says so.
      detail: record.postDate
        ? `${record.format} · ${formatDayLabel(toIsoDate(record.postDate))}`
        : `${record.format} · no date yet`,
    });
    return { success: true };
  } catch (err) {
    return failure(err, "Couldn't save the entry");
  }
}

export async function updateContentItem(
  id: string,
  input: ContentFormValues
): Promise<CalendarResult> {
  const invalid = invalidContent(input);
  if (invalid) return { success: false, error: invalid };

  try {
    const change: RecordChange<ContentItemRecord> | null = await writeContentItem({
      id,
      title: input.title,
      format: input.format,
      status: input.status,
      postDate: input.postDate ? toSheetDate(input.postDate) : "",
      notes: input.notes,
      editorTransactionId: linkedVideoId(input.editorTransactionId),
    });
    if (!change) return { success: false, error: "That entry no longer exists" };
    revalidateStores("contentPlan");
    await recordActivity({
      action: "content.updated",
      entity: { type: "content", id: change.after.id, label: contentLabel(change.after.title) },
      detail: describeChanges(change, contentFields),
    });
    return { success: true };
  } catch (err) {
    return failure(err, "Couldn't save the entry");
  }
}

export async function deleteContentItem(id: string): Promise<CalendarResult> {
  try {
    // The writer answers the record it removed, because a title cannot be read
    // back once the row is gone and the event has to name it.
    const removed = await removeContentItem(id);
    if (!removed) return { success: false, error: "That entry no longer exists" };
    revalidateStores("contentPlan");
    await recordActivity({
      action: "content.deleted",
      entity: { type: "content", id: removed.id, label: contentLabel(removed.title) },
      detail: removed.format,
    });
    return { success: true };
  } catch (err) {
    return failure(err, "Couldn't delete the entry");
  }
}
