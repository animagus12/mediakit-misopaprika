import { groupActivitiesByDay } from "@/lib/activity";
import type { Activity } from "@/repositories/activity";
import { ActivityRow } from "./ActivityRow";

interface ActivityFeedProps {
  activities: Activity[];
  /** Rendering time, passed down so every row and heading agree on "today". */
  now?: Date;
}

// The full feed: rows under sticky day headings. The dashboard's card renders
// ActivityRow directly instead, since six rows need no headings.
export function ActivityFeed({ activities, now = new Date() }: ActivityFeedProps) {
  const days = groupActivitiesByDay(activities, now);

  return (
    <div className="space-y-6">
      {days.map((day) => (
        <section key={day.key}>
          <h2 className="sticky top-12 z-10 -mx-2 bg-background/85 px-2 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
            {day.label}
          </h2>
          <div className="mt-1 space-y-0.5">
            {day.items.map((activity) => (
              <ActivityRow key={activity.id} activity={activity} now={now} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
