import { Card, CardContent } from "@/components/ui/card";
import { EditCollaborationSheet } from "./EditCollaborationSheet";
import { CollaborationStatusSelect } from "./CollaborationStatusSelect";
import type { Collaboration } from "@/repositories/collaborations";

// An active-pipeline card: most of it is a stretched hit target that opens
// the full edit sheet (the `absolute inset-0` button), with the status
// <Select> lifted above it (`z-10`) as the one carve-out so the pipeline
// stage can be advanced in place. Keeping the two as DOM siblings — not the
// old badge-inside-a-<button> — avoids the nested-interactive hydration bug.
export function ActiveCollaborationCard({ collaboration }: { collaboration: Collaboration }) {
  return (
    <Card size="sm" className="relative">
      <CardContent className="space-y-0.5">
        <div className="flex items-start justify-between gap-2">
          <span className="min-w-0 truncate pt-1 font-heading text-sm font-medium">
            {collaboration.brand}
          </span>
          <div className="relative z-10 shrink-0">
            <CollaborationStatusSelect collaboration={collaboration} />
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="truncate">{collaboration.reels || "No reels"}</span>
          <span className="truncate">{collaboration.story || "No story"}</span>
          {collaboration.date && (
            <span className="ml-auto shrink-0 whitespace-nowrap">{collaboration.date}</span>
          )}
        </div>
      </CardContent>

      <EditCollaborationSheet
        collaboration={collaboration}
        trigger={
          <button
            type="button"
            aria-label={`Edit ${collaboration.brand} collaboration`}
            className="absolute inset-0 rounded-lg transition hover:ring-2 hover:ring-primary/20 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
          />
        }
      />
    </Card>
  );
}
