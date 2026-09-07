import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/invoice";
import { describeActivity, formatActivityAge, formatActivityTime } from "@/lib/activity";
import type { ActivityTone } from "@/lib/activity";
import type { Activity } from "@/repositories/activity";

interface ActivityRowProps {
  activity: Activity;
  /**
   * "age" reads "2h ago" and suits a short dashboard list; "time" reads
   * "14:02" and suits /activity, where the day heading already carries the
   * date. Both are rendered on the server, so neither can drift on hydration.
   */
  stamp?: "age" | "time";
  /** Passed in rather than read per row, so every row on a page agrees. */
  now?: Date;
  className?: string;
}

// globals.css has no success token, so the meaning-carrying colours follow
// the destructive variant's shape: a raw palette hue at low opacity.
const TONES: Record<ActivityTone, string> = {
  default: "bg-muted text-muted-foreground",
  positive: "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  destructive: "bg-rose-500/10 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400",
};

export function ActivityRow({ activity, stamp = "time", now, className }: ActivityRowProps) {
  const { title, href, Icon, tone } = describeActivity(activity);
  const meta = [activity.detail, activity.amount != null ? formatMoney(activity.amount) : null]
    .filter(Boolean)
    .join(" · ");

  const body = (
    <>
      <span
        className={cn(
          "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full",
          TONES[tone]
        )}
      >
        <Icon className="size-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{title}</span>
        {meta && <span className="block truncate text-xs text-muted-foreground">{meta}</span>}
      </span>
      <time
        dateTime={activity.at}
        className="shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground"
      >
        {stamp === "age" ? formatActivityAge(activity.at, now) : formatActivityTime(activity.at)}
      </time>
    </>
  );

  // A row whose record still exists is a link; one describing something
  // deleted is not, rather than being a link to a 404.
  const shared = cn(
    "flex items-start gap-2.5 rounded-md px-2 py-2 text-sm",
    href && "transition-colors hover:bg-muted/50",
    className
  );

  return href ? (
    <Link href={href} className={cn(shared, "pointer-coarse:min-h-11")}>
      {body}
    </Link>
  ) : (
    <div className={shared}>{body}</div>
  );
}
