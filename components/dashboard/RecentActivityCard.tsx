import Link from "next/link";
import { History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActivityRow } from "@/components/activity/ActivityRow";
import { cn } from "@/lib/utils";
import type { Activity } from "@/repositories/activity";

interface RecentActivityCardProps {
  activities: Activity[];
  className?: string;
}

// The most recent handful of writes, newest first. Renders nothing on an
// empty log rather than an empty state: on a fresh install there is genuinely
// nothing to say, and a card explaining that is worse than no card, which is
// the same call NeedsAttentionCard makes.
export function RecentActivityCard({ activities, className }: RecentActivityCardProps) {
  if (activities.length === 0) return null;
  const now = new Date();

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <History className="size-4 text-muted-foreground" />
          <CardTitle>Recent activity</CardTitle>
        </div>
        <CardAction>
          <Button asChild size="sm" variant="ghost">
            <Link href="/activity">View all</Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-0.5">
        {activities.map((activity) => (
          <ActivityRow key={activity.id} activity={activity} stamp="age" now={now} />
        ))}
      </CardContent>
    </Card>
  );
}
