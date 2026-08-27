"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateCollaboration } from "@/app/(dashboard)/actions";
import { STATUS_OPTIONS, COLLABORATION_TYPES, toIsoDate } from "@/lib/collaborations";
import { cn } from "@/lib/utils";
import type { Collaboration } from "@/repositories/collaborations";

interface CollaborationStatusSelectProps {
  collaboration: Collaboration;
  className?: string;
}

// Advance a deal through the pipeline straight from its dashboard card,
// without opening the full edit sheet. The Select reflects the new stage
// instantly (optimistic) while the sheet write runs; the success toast
// carries an Undo that moves it back. Writes the same CollaborationUpdate the
// sheet does (every other field carried through unchanged), so the two stay
// interchangeable. Type is coerced to a valid option the same way
// EditCollaborationSheet does it; an off-list status is kept selectable so
// the control never shows blank.
export function CollaborationStatusSelect({
  collaboration,
  className,
}: CollaborationStatusSelectProps) {
  const [isPending, startTransition] = useTransition();
  const [status, setOptimisticStatus] = useOptimistic(collaboration.status);

  const options = STATUS_OPTIONS.includes(status)
    ? STATUS_OPTIONS
    : [status, ...STATUS_OPTIONS];

  function move(nextStatus: string, previousStatus: string, isUndo: boolean) {
    startTransition(async () => {
      setOptimisticStatus(nextStatus);

      const type = COLLABORATION_TYPES.includes(
        collaboration.type as (typeof COLLABORATION_TYPES)[number]
      )
        ? (collaboration.type as (typeof COLLABORATION_TYPES)[number])
        : "Barter";

      const result = await updateCollaboration({
        id: collaboration.id,
        brand: collaboration.brand,
        campaign: collaboration.campaign,
        type,
        reels: collaboration.reels,
        story: collaboration.story,
        status: nextStatus,
        amount: collaboration.amount,
        barterValue: collaboration.barterValue,
        date: toIsoDate(collaboration.date) || new Date().toISOString().slice(0, 10),
      });

      if (!result.success) {
        toast.error("Couldn't update status", { description: result.error });
        return;
      }
      if (!isUndo) {
        toast.success(`${collaboration.brand} → ${nextStatus}`, {
          action: {
            label: "Undo",
            onClick: () => move(previousStatus, nextStatus, true),
          },
        });
      }
    });
  }

  function handleChange(nextStatus: string) {
    if (nextStatus === status) return;
    move(nextStatus, status, false);
  }

  return (
    <Select value={status} onValueChange={handleChange} disabled={isPending}>
      <SelectTrigger size="sm" aria-label="Change status" className={cn("max-w-[9.5rem]", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
