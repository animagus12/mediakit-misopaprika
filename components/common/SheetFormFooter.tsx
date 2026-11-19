import type { ReactNode } from "react";
import { CircleAlert, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SheetClose, SheetFooter } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

interface SheetFormFooterProps {
  /** The <form> the main button submits; it sits in the sheet's scrolling body, not here. */
  formId: string;
  /** Verb and noun: "Save campaign", "Add campaign". */
  submitLabel: string;
  /** The same verb while it runs: "Saving…". */
  pendingLabel: string;
  isPending: boolean;
  /** What the form adds up to, on the left; see SheetFormFooterFigure. */
  summary?: ReactNode;
  /** Whether the form differs from what was opened. Left out on a form for something new. */
  dirty?: boolean;
  /** Why the last save failed, said beside the button that was pressed. */
  error?: string | null;
  /** Something worth knowing before saving that doesn't stop it. */
  warning?: string | null;
}

/**
 * The one footer a form sheet ends in, pinned under its scrolling body so the
 * main action never scrolls away: what the form adds up to on the left, Cancel
 * and the main button on the right.
 *
 * On a phone the summary takes its own row and the button the full width;
 * Cancel is left to the sheet's own close button there. Deleting is never
 * here: it lives in the sheet's header menu, away from the button pressed
 * most.
 */
export function SheetFormFooter({
  formId,
  submitLabel,
  pendingLabel,
  isPending,
  summary,
  dirty,
  error,
  warning,
}: SheetFormFooterProps) {
  const hasSummary = summary != null || dirty !== undefined;
  return (
    <SheetFooter className="gap-3 border-t border-border bg-muted/40 px-6 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      {error ? (
        <p role="alert" className="flex items-start gap-1.5 text-xs text-destructive">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : warning ? (
        <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {warning}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
        {hasSummary && (
          <div className="min-w-0 basis-full sm:flex-1 sm:basis-auto">
            {dirty !== undefined && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span
                  aria-hidden
                  className={cn("size-1.5 rounded-full", dirty ? "bg-amber-500" : "bg-muted-foreground/40")}
                />
                {dirty ? "Unsaved changes" : "No changes yet"}
              </p>
            )}
            {summary}
          </div>
        )}
        <SheetClose asChild>
          <Button type="button" variant="outline" size="lg" className="hidden h-9 px-3 sm:inline-flex">
            Cancel
          </Button>
        </SheetClose>
        <Button
          type="submit"
          form={formId}
          size="lg"
          disabled={isPending}
          className={cn("h-9 w-full px-3 text-sm sm:w-auto", !hasSummary && "sm:ml-auto")}
        >
          {isPending && <Spinner />}
          {isPending ? pendingLabel : submitLabel}
        </Button>
      </div>
    </SheetFooter>
  );
}

/** A figure for the footer's summary: "₹ 55,000 deal total", with an optional aside. */
export function SheetFormFooterFigure({
  value,
  label,
  note,
}: {
  value: string;
  label: string;
  note?: string;
}) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-1.5 tabular-nums">
      <span className="text-base font-semibold">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
      {note && <span className="text-xs text-muted-foreground">· {note}</span>}
    </p>
  );
}
