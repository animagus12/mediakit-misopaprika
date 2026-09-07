"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { deleteContentItem, updateContentItem } from "@/app/calendar/actions";
import { toIsoDate } from "@/lib/campaigns";
import {
  contentLabel,
  type ContentFormValues,
  type EditorVideoOption,
} from "@/lib/contentPlan";
import type { ContentItem } from "@/repositories/contentPlan";
import { ContentFormFields } from "./ContentFormFields";

function formFromItem(item: ContentItem): ContentFormValues {
  return {
    title: item.title,
    format: item.format,
    status: item.status,
    // The store keeps DD/MM/YYYY; <input type="date"> needs yyyy-mm-dd, and
    // answers "" for anything it can't parse rather than silently rejecting it.
    postDate: toIsoDate(item.postDate),
    notes: item.notes,
    editorTransactionId: item.editorTransactionId,
  };
}

interface EditContentSheetProps {
  item: ContentItem;
  trigger: ReactNode;
  videoOptions?: EditorVideoOption[];
}

// Edit or remove one of the creator's own entries. Takes a trigger rather than
// rendering its own button, so a calendar row can decide how the affordance
// looks: the same shape EditCampaignSheet uses.
export function EditContentSheet({ item, trigger, videoOptions = [] }: EditContentSheetProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => formFromItem(item));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateContentItem(item.id, form);
      if (!result.success) {
        setError(result.error);
        return;
      }
      toast.success(`${contentLabel(form.title)} updated`);
      setOpen(false);
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteContentItem(item.id);
      if (!result.success) {
        toast.error("Couldn't delete", { description: result.error });
        return;
      }
      toast.success(`${contentLabel(item.title)} removed`);
      setOpen(false);
    });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Reopening shows what is stored, not what was half-typed and
        // abandoned last time.
        if (next) {
          setForm(formFromItem(item));
          setError(null);
        }
      }}
    >
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="flex flex-col gap-0">
        <SheetHeader>
          <SheetTitle>Edit content</SheetTitle>
          <SheetDescription>
            Clearing the posting date sends this back to the ideas list.
          </SheetDescription>
        </SheetHeader>

        <form
          id={`edit-content-${item.id}`}
          onSubmit={handleSubmit}
          className="flex-1 space-y-4 overflow-y-auto px-6"
        >
          <ContentFormFields
            idPrefix={`edit-content-${item.id}`}
            form={form}
            setForm={setForm}
            videoOptions={videoOptions}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </form>

        <SheetFooter>
          <div className="flex flex-row gap-2">
            <SheetClose asChild>
              <Button type="button" variant="outline" className="flex-1">
                Cancel
              </Button>
            </SheetClose>
            <Button
              type="submit"
              form={`edit-content-${item.id}`}
              className="flex-1"
              disabled={isPending}
            >
              {isPending ? "Saving…" : "Save"}
            </Button>
          </div>
          {/* Deleting is the one thing here that can't be undone from the UI,
              so it sits apart from the pair above and asks first. Shelving
              rather than removing is what the "Dropped" status is for. */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="ghost" size="sm" disabled={isPending}>
                <Trash2 />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {contentLabel(item.title)}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes it from the plan for good. To keep the record but take it off the
                  calendar, set its status to Dropped instead.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
