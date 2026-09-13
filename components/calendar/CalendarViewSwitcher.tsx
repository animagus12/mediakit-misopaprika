"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, CalendarRange, SquareKanban, type LucideIcon } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import {
  CALENDAR_VIEWS,
  CALENDAR_VIEW_COOKIE,
  type CalendarView,
} from "@/lib/contentCalendar";

const VIEW_META: Record<CalendarView, { label: string; icon: LucideIcon }> = {
  month: { label: "Month", icon: CalendarDays },
  week: { label: "Week", icon: CalendarRange },
  board: { label: "Board", icon: SquareKanban },
};

// A year: long enough that the choice is simply "how this device reads the
// calendar", short enough that a device nobody uses any more forgets it.
const REMEMBER_SECONDS = 60 * 60 * 24 * 365;

interface CalendarViewSwitcherProps {
  view: CalendarView;
  /**
   * Where each view opens, built by the page so switching keeps the date in
   * view: a week opens its month, a month opens its first week.
   */
  hrefs: Record<CalendarView, string>;
  /** Whether the URL named the view. When it didn't, a phone-width screen gets the week. */
  explicitView?: boolean;
  className?: string;
}

// Below sm, where the month grid can show a post only as a dot.
const PHONE_WIDTH = "(max-width: 639px)";

// Month, Week or Board. The pick is written to a cookie as well as the URL,
// so the next visit from a larger screen opens the same view. A phone always
// opens on the week instead (see resolveCalendarView).
export function CalendarViewSwitcher({
  view,
  hrefs,
  explicitView = false,
  className,
}: CalendarViewSwitcherProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // The server picks a phone by its user agent, which a phone can hide (a
  // "desktop site" request, a browser that reports as desktop). The screen's
  // width can't be hidden, so a phone-width screen that was still given
  // another view, with nothing in the URL asking for it, moves to the week.
  // replace, not push, so Back doesn't return to the view it was moved off.
  useEffect(() => {
    if (explicitView || view === "week") return;
    if (window.matchMedia(PHONE_WIDTH).matches) router.replace(hrefs.week);
  }, [explicitView, view, hrefs.week, router]);

  function select(next: string) {
    // Radix answers "" when the open item is pressed again; a view can't be
    // unset, so that press does nothing.
    const picked = CALENDAR_VIEWS.find((entry) => entry === next);
    if (!picked || picked === view) return;
    document.cookie = `${CALENDAR_VIEW_COOKIE}=${picked}; path=/calendar; max-age=${REMEMBER_SECONDS}; samesite=lax`;
    startTransition(() => router.push(hrefs[picked]));
  }

  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      spacing={0}
      value={view}
      onValueChange={select}
      aria-label="Calendar view"
      className={cn(isPending && "opacity-70", className)}
    >
      {CALENDAR_VIEWS.map((entry) => {
        const { label, icon: Icon } = VIEW_META[entry];
        return (
          <ToggleGroupItem
            key={entry}
            value={entry}
            className="gap-1.5 px-2.5 text-xs pointer-coarse:h-11 pointer-coarse:px-3.5"
          >
            <Icon />
            {label}
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}
