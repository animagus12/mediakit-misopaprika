"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { setContentStatus } from "@/app/calendar/actions";
import { CONTENT_STATUSES, contentLabel, isContentStatus } from "@/lib/contentPlan";
import { cn } from "@/lib/utils";
import type { ContentStatus } from "@/repositories/contentPlan";

interface ContentStatusSelectProps {
  id: string;
  title: string;
  status: ContentStatus;
  className?: string;
}

// The own-post counterpart of CampaignStatusSelect: moves an entry through the
// pipeline from wherever it is listed, optimistic, with an Undo on the toast.
// Writes through setContentStatus, which touches the status and nothing else,
// the same action the calendar board's drag uses.
export function ContentStatusSelect({ id, title, status: savedStatus, className }: ContentStatusSelectProps) {
  const [isPending, startTransition] = useTransition();
  const [status, setOptimisticStatus] = useOptimistic(savedStatus);
  const label = contentLabel(title);

  function move(nextStatus: ContentStatus, previousStatus: ContentStatus, isUndo: boolean) {
    startTransition(async () => {
      setOptimisticStatus(nextStatus);
      const result = await setContentStatus(id, nextStatus);
      if (!result.success) {
        toast.error("Couldn't update status", { description: result.error });
        return;
      }
      if (!isUndo) {
        toast.success(`${label} moved to ${nextStatus}`, {
          action: { label: "Undo", onClick: () => move(previousStatus, nextStatus, true) },
        });
      }
    });
  }

  function handleChange(nextStatus: string) {
    if (nextStatus === status || !isContentStatus(nextStatus)) return;
    move(nextStatus, status, false);
  }

  return (
    <Select value={status} onValueChange={handleChange} disabled={isPending}>
      <SelectTrigger size="sm" aria-label={`Change status of ${label}`} className={cn("max-w-[9.5rem]", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {CONTENT_STATUSES.map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
