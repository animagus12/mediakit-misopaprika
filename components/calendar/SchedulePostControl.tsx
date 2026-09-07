"use client";

import { useState, useTransition } from "react";
import { CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { schedulePost } from "@/app/calendar/actions";
import type { PostSource } from "@/lib/contentCalendar";

interface SchedulePostControlProps {
  /** Which store the row came from: decides which writer the action calls. */
  source: PostSource;
  id: string;
  /** The deal's name, for the toast: this control shows no other label. */
  label: string;
  /** yyyy-mm-dd the deal posts on today, or "" when it has no date yet. */
  currentIsoDate?: string;
  className?: string;
}

// Puts a post on a day, moves it to another, or takes it back off. Everything
// else on the record is left alone (see schedulePost), which is what makes
// this safe to fire from a row rather than from a form.
//
// One control for both stores: a brand deal and an own reel are scheduled the
// same way, and `source` is the only thing that differs.
export function SchedulePostControl({
  source,
  id,
  label,
  currentIsoDate = "",
  className,
}: SchedulePostControlProps) {
  const [value, setValue] = useState(currentIsoDate);
  const [isPending, startTransition] = useTransition();

  // Nothing to save until the date actually differs from the stored one, so
  // the button can't fire a write that would change nothing.
  const changed = value !== currentIsoDate;
  const clearing = changed && value === "";

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!changed) return;

    startTransition(async () => {
      const result = await schedulePost(source, id, value);
      if (!result.success) {
        // Put the field back to what is actually stored, so the row never
        // shows a date the record doesn't have.
        setValue(currentIsoDate);
        toast.error("Couldn't save the posting date", { description: result.error });
        return;
      }
      toast.success(
        clearing ? `${label}: posting date cleared` : `${label}: scheduled`,
        { description: clearing ? undefined : "The calendar has been updated." }
      );
    });
  }

  return (
    <form onSubmit={submit} className={cn("flex items-center gap-1.5", className)}>
      <Input
        type="date"
        aria-label={`Posting date for ${label}`}
        value={value}
        disabled={isPending}
        onChange={(event) => setValue(event.target.value)}
        className="h-8 w-[9.5rem] text-xs"
      />
      {changed && (
        <Button type="submit" size="sm" variant={clearing ? "ghost" : "outline"} disabled={isPending}>
          {!clearing && <CalendarPlus />}
          {isPending ? "Saving…" : clearing ? "Clear" : currentIsoDate ? "Move" : "Schedule"}
        </Button>
      )}
    </form>
  );
}
