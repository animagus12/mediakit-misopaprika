"use client";

import { useEffect, useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { refreshDashboard } from "@/app/(dashboard)/actions";

// This shows how long ago the page's data was loaded and lets the creator
// force a re-render on demand, e.g. right after editing data in another tab.
function relativeTime(fromMs: number, nowMs: number): string {
  const seconds = Math.round((nowMs - fromMs) / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function LastRefreshed({ loadedAtISO }: { loadedAtISO: string }) {
  const loadedAt = new Date(loadedAtISO).getTime();
  // Start equal to loadedAt so the server render and first client render both
  // read "just now" — no hydration mismatch. loadedAtISO is the page's render
  // time, so it genuinely is ~now on load; the interval advances it from there.
  const [now, setNow] = useState(loadedAt);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [loadedAtISO]);

  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      <span suppressHydrationWarning>Loaded {relativeTime(loadedAt, now)}</span>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await refreshDashboard();
            toast.success("Dashboard refreshed");
          })
        }
      >
        <RefreshCw className={isPending ? "animate-spin" : undefined} />
        {isPending ? "Refreshing…" : "Refresh"}
      </Button>
    </div>
  );
}
