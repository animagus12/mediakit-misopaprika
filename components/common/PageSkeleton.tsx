import { Skeleton } from "@/components/ui/skeleton";

/**
 * Placeholder for a page's content while its data loads. Generic on purpose:
 * one shape stands in for every dashboard page, so it follows what they have
 * in common (the shared container, a heading row with an action, a band of
 * summary cards, then rows) rather than any one of them.
 */
export function PageSkeleton() {
  return (
    <div
      role="status"
      className="mx-auto max-w-screen-lg space-y-8 px-4 py-10 xl:max-w-6xl 2xl:max-w-[1440px]"
    >
      <span className="sr-only">Loading</span>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-3 w-64 max-w-full" />
        </div>
        <Skeleton className="h-8 w-32 shrink-0" />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-20 rounded-lg" />
        ))}
      </div>

      <div className="space-y-2">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-12 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
