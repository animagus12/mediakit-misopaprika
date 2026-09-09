"use client";

import { useState, useTransition } from "react";
import { Check, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  closeBrandAsWentCold,
  logCheckIn,
  logCheckInReply,
  removeCheckIn,
} from "@/app/brands/actions";
import { formatDayLabel, todayKey } from "@/lib/day";
import { outreachStatus, sortCheckIns, type OutreachState } from "@/lib/outreach";
import type { CheckIn, CheckInChannel } from "@/repositories/brandCheckIns";

const CHANNELS: CheckInChannel[] = ["Email", "Instagram DM", "WhatsApp", "Call", "Other"];

// Muted palette colours at low opacity, matching the convention the rest of
// the app uses for meaning: globals.css carries no success/warning token.
const STATE_STYLE: Record<OutreachState, string> = {
  close: "border-rose-500/25 bg-rose-500/5 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400",
  overdue: "border-amber-500/25 bg-amber-500/5 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  due: "border-amber-500/25 bg-amber-500/5 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  holding: "border-sky-500/25 bg-sky-500/5 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400",
  quiet: "text-muted-foreground",
};

interface BrandCheckInsTabProps {
  brandId: string;
  checkIns: CheckIn[]; // already scoped to this brand
  /** False once the brand is a deal or already closed: the log stays readable, the counter stops applying. */
  inPursuit: boolean;
}

export function BrandCheckInsTab({ brandId, checkIns, inPursuit }: BrandCheckInsTabProps) {
  const [date, setDate] = useState(todayKey());
  const [channel, setChannel] = useState<CheckInChannel>("Email");
  const [respondBy, setRespondBy] = useState("");
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const status = outreachStatus(checkIns);
  // Newest first to read, oldest first to count: sortCheckIns is the one that
  // settles same-day ties, so the display order is derived from it rather
  // than sorted a second, subtly different way.
  const rows = sortCheckIns(checkIns).reverse();

  function run(action: () => Promise<{ success: boolean; error?: string }>, onDone?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        setError(result.error ?? "Something went wrong");
        return;
      }
      onDone?.();
    });
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!date) return;
    run(
      () =>
        logCheckIn({
          subjectKind: "brand",
          subjectId: brandId,
          date,
          channel,
          respondBy: respondBy || null,
          note,
        }),
      () => {
        setRespondBy("");
        setNote("");
        setDate(todayKey());
      }
    );
  }

  return (
    <div className="space-y-4">
      {inPursuit && status.label !== "" && (
        <Card className={STATE_STYLE[status.state]}>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div>
              <p className="text-sm font-medium">{status.label}</p>
              <p className="text-xs opacity-80">
                {status.lastCheckIn
                  ? `Last check-in ${formatDayLabel(status.lastCheckIn)}`
                  : "No check-ins yet"}
              </p>
            </div>
            {status.state === "close" && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={() => run(() => closeBrandAsWentCold(brandId))}
              >
                Close as Went Cold
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="check-in-date">Date</Label>
            <Input
              id="check-in-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="check-in-channel">Channel</Label>
            <Select value={channel} onValueChange={(value) => setChannel(value as CheckInChannel)}>
              <SelectTrigger id="check-in-channel" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHANNELS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="check-in-respond-by">Answer promised by</Label>
            <Input
              id="check-in-respond-by"
              type="date"
              value={respondBy}
              onChange={(event) => setRespondBy(event.target.value)}
            />
          </div>
        </div>
        <Textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="What you asked, in a line…"
          rows={2}
        />
        <p className="text-xs text-muted-foreground">
          Leave the promised date empty unless they named one. A date parks this brand until it
          passes, instead of nudging you every week.
        </p>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <Button type="submit" size="sm" disabled={isPending || !date}>
          Log check-in
        </Button>
      </form>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-xs text-muted-foreground">
            No check-ins logged yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((checkIn) => (
            <Card key={checkIn.id} size="sm">
              <CardContent className="flex items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{formatDayLabel(checkIn.date)}</p>
                    <Badge variant="secondary">{checkIn.channel}</Badge>
                    {checkIn.replied && (
                      <Badge
                        variant="outline"
                        className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
                      >
                        Replied
                      </Badge>
                    )}
                  </div>
                  {checkIn.note !== "" && <p className="whitespace-pre-wrap text-sm">{checkIn.note}</p>}
                  {checkIn.respondBy && (
                    <p className="text-xs text-muted-foreground">
                      Answer promised by {formatDayLabel(checkIn.respondBy)}
                    </p>
                  )}
                  {!checkIn.replied && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="-ml-2 h-7 text-xs text-muted-foreground"
                      disabled={isPending}
                      onClick={() =>
                        run(() =>
                          logCheckInReply({
                            id: checkIn.id,
                            replied: true,
                            respondBy: checkIn.respondBy,
                          })
                        )
                      }
                    >
                      <Check className="size-3" />
                      They replied
                    </Button>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  disabled={isPending}
                  onClick={() => run(() => removeCheckIn(checkIn.id))}
                  aria-label="Remove check-in"
                >
                  <Trash2 />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
