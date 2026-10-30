"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setCampaignWorkflowStatus } from "@/app/(dashboard)/actions";
import { STATUS_OPTIONS } from "@/lib/campaigns";
import { cn } from "@/lib/utils";
import type { Campaign, CampaignStatus } from "@/repositories/campaigns";

interface CampaignStatusSelectProps {
  campaign: Campaign;
  className?: string;
}

// Advance a deal through the pipeline straight from its dashboard card,
// without opening the full edit sheet. The Select reflects the new stage
// instantly (optimistic) while the update runs; the success toast carries an
// Undo that moves it back. Writes the status and nothing else: resaving the
// whole deal from what this card holds used to unlink its editing job and
// re-send payment fields a status move should never touch. The status needs
// no coercion: the store reads every record into the shared vocabulary, so it
// is always one of the options.
export function CampaignStatusSelect({
  campaign,
  className,
}: CampaignStatusSelectProps) {
  const [isPending, startTransition] = useTransition();
  const [status, setOptimisticStatus] = useOptimistic(campaign.status);

  function move(nextStatus: CampaignStatus, previousStatus: CampaignStatus, isUndo: boolean) {
    startTransition(async () => {
      setOptimisticStatus(nextStatus);

      const result = await setCampaignWorkflowStatus(campaign.id, nextStatus);

      if (!result.success) {
        toast.error("Couldn't update status", { description: result.error });
        return;
      }
      if (!isUndo) {
        toast.success(`${campaign.brand} → ${nextStatus}`, {
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
    move(nextStatus as CampaignStatus, status, false);
  }

  return (
    <Select value={status} onValueChange={handleChange} disabled={isPending}>
      <SelectTrigger size="sm" aria-label="Change status" className={cn("max-w-[9.5rem]", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUS_OPTIONS.filter((option) => option !== "On Hold").map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
        <SelectSeparator />
        <SelectItem value="On Hold">On Hold</SelectItem>
      </SelectContent>
    </Select>
  );
}
