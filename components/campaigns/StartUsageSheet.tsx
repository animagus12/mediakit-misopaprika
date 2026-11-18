"use client";

import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { clearCampaignUsageStart, startCampaignUsage } from "@/app/(dashboard)/actions";
import { toSheetDate } from "@/lib/campaigns";
import { addDays, isDayKey, todayKey } from "@/lib/day";
import { formatUsageDays } from "@/lib/usageRights";
import type { UsageStatus } from "@/repositories/campaigns";

interface StartUsageSheetProps {
  campaignId: string;
  brand: string;
  /** The base term in days; ignored on an indefinite licence. */
  days: number;
  indefinite: boolean;
  /** yyyy-mm-dd the licence counts from now, "" while it has not started. */
  startedOn: string;
  /** yyyy-mm-dd the deal was struck: the earliest day the picker offers. */
  earliest: string;
  status: UsageStatus;
  /**
   * yyyy-mm-dd a paused or ended licence stopped on, the latest day its start
   * can move to (see latestUsageStart); "" on a running one.
   */
  latest: string;
  trigger: ReactNode;
}

// What the picked day means for the term: "30 days, ending 18/12/2026" on a
// running licence. A paused one's end keeps moving and an ended one's no
// longer applies, so those say what bounds the day instead.
function termHint(day: string, days: number, indefinite: boolean, status: UsageStatus, latest: string): string {
  if (status !== "active" && latest) {
    return `It was ${status} on ${toSheetDate(latest)}, so it can't have started after that.`;
  }
  if (indefinite) return "No end date. This records when the brand started running it.";
  if (!isDayKey(day) || days <= 0) return "";
  return `${formatUsageDays(days)}, ending ${toSheetDate(addDays(day, days))}.`;
}

/**
 * Starts a licence's term counting, moves the day a started one counts from,
 * or clears it back to not started.
 *
 * The day opens on today, so starting a licence the moment the brand starts
 * running the ad is one more click; picking an earlier day covers the brand
 * that started before anyone recorded it. Clearing is for a licence started
 * by mistake, or one whose brand has not actually begun: its whole term is
 * unspent again.
 */
export function StartUsageSheet({
  campaignId,
  brand,
  days,
  indefinite,
  startedOn,
  earliest,
  status,
  latest,
  trigger,
}: StartUsageSheetProps) {
  const starting = startedOn === "";
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState(() => startedOn || todayKey());
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const formId = `start-usage-${campaignId}`;
  const hint = termHint(day, days, indefinite, status, latest);
  const today = todayKey();
  const max = latest && latest < today ? latest : today;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await startCampaignUsage(campaignId, day);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setOpen(false);
      toast.success(starting ? `${brand}: ad usage started` : `${brand}: start date moved`, {
        description: status === "active" && hint ? hint : `Counts from ${toSheetDate(day)}.`,
      });
    });
  }

  function handleClear() {
    setError(null);
    startTransition(async () => {
      const result = await clearCampaignUsageStart(campaignId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setOpen(false);
      toast.success(`${brand}: ad usage not started`, {
        description: indefinite ? undefined : `${formatUsageDays(days)} left to use.`,
      });
    });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Reseeded on open: a sheet left mounted overnight would otherwise
        // offer yesterday as "today".
        if (next) {
          setDay(startedOn || todayKey());
          setError(null);
        }
      }}
    >
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="flex flex-col gap-0">
        <SheetHeader>
          <SheetTitle>{starting ? "Start ad usage" : "Change start date"}</SheetTitle>
          <SheetDescription>
            {starting
              ? `${brand}'s licence counts from the day it starts. Leave today to start it now.`
              : `Moves the day ${brand}'s licence counts from.`}
          </SheetDescription>
        </SheetHeader>

        <form id={formId} onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto px-6">
          <div className="space-y-2">
            <Label htmlFor={`${formId}-day`}>Start date</Label>
            <Input
              id={`${formId}-day`}
              type="date"
              required
              min={earliest || undefined}
              max={max}
              value={day}
              onChange={(event) => setDay(event.target.value)}
            />
            {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
          </div>
          {!starting && (
            <div className="space-y-1">
              <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={handleClear}>
                Clear start date
              </Button>
              <p className="text-[11px] text-muted-foreground">
                Puts the licence back to not started, with its whole term unused and any pause or end cleared.
              </p>
            </div>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </form>

        <SheetFooter className="flex-row">
          <SheetClose asChild>
            <Button type="button" variant="outline" className="flex-1">
              Cancel
            </Button>
          </SheetClose>
          <Button type="submit" form={formId} className="flex-1" disabled={isPending}>
            {isPending ? "Saving…" : starting ? "Start" : "Save date"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
