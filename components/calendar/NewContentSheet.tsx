"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { createContentItem } from "@/app/calendar/actions";
import { contentLabel, type EditorVideoOption } from "@/lib/contentPlan";
import { formatDayLabel, isDayKey } from "@/lib/day";
import { ContentFormFields, contentInitialForm } from "./ContentFormFields";

interface NewContentSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * yyyy-mm-dd to prefill the posting date with, or "" for none.
   *
   * This is what lets a click on a day in the grid mean "add something here":
   * the day is decided before the form is ever shown.
   */
  initialDate?: string;
  /** Videos already sent to an editor, offered as the entry's title. */
  videoOptions?: EditorVideoOption[];
}

// Controlled, and trigger-less, because it has two callers that open it very
// differently: a button in the page header, and any day cell in the month
// grid. Keeping the form in one place is what stops the two from drifting.
export function NewContentSheet({
  open,
  onOpenChange,
  initialDate = "",
  videoOptions = [],
}: NewContentSheetProps) {
  const [form, setForm] = useState(() => contentInitialForm(initialDate));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Reseed whenever the sheet opens, so clicking a second day shows that day
  // and never the last one's half-typed draft.
  //
  // Adjusting state during render rather than in an effect: `open` is
  // controlled by the caller, so Radix's own onOpenChange never fires for an
  // open, and an effect would paint one frame of the stale form first.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setForm(contentInitialForm(initialDate));
      setError(null);
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createContentItem(form);
      if (!result.success) {
        setError(result.error);
        return;
      }
      toast.success(`${contentLabel(form.title)} added`, {
        description: form.postDate
          ? undefined
          : "It's in the ideas list until you give it a day.",
      });
      onOpenChange(false);
    });
  }

  // Naming the day in the description is the confirmation that the click
  // landed where it looked like it did.
  const day = isDayKey(form.postDate) ? formatDayLabel(form.postDate) : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col gap-0">
        <SheetHeader>
          <SheetTitle>{day ? `New content, ${day}` : "New content"}</SheetTitle>
          <SheetDescription>
            Something you are making for yourself. Brand deals come from a campaign instead, so
            they keep their money, invoice and payment record.
          </SheetDescription>
        </SheetHeader>

        <form
          id="new-content-form"
          onSubmit={handleSubmit}
          className="flex-1 space-y-4 overflow-y-auto px-6"
        >
          <ContentFormFields
            idPrefix="new-content"
            form={form}
            setForm={setForm}
            videoOptions={videoOptions}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </form>

        <SheetFooter className="flex-row">
          <SheetClose asChild>
            <Button type="button" variant="outline" className="flex-1">
              Cancel
            </Button>
          </SheetClose>
          {/* No disabled-until-titled guard: an untitled entry is a real plan
              ("something on Friday") and contentLabel gives it a stand-in. */}
          <Button type="submit" form="new-content-form" className="flex-1" disabled={isPending}>
            {isPending ? "Adding…" : "Add to plan"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
