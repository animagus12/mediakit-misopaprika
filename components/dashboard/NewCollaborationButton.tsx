"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { createCollaboration } from "@/app/(dashboard)/actions";
import { CollaborationFormFields, collaborationInitialForm } from "./CollaborationFormFields";

export function NewCollaborationButton() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(collaborationInitialForm);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createCollaboration({
        brand: form.brand.trim(),
        campaign: form.campaign.trim(),
        type: form.type,
        reels: form.reels,
        story: form.story,
        status: form.status,
        amount: Number(form.amount) || 0,
        barterValue: Number(form.barterValue) || 0,
        date: form.date,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setForm(collaborationInitialForm());
      setOpen(false);
    });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setError(null);
      }}
    >
      <SheetTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="size-3.5" />
          New collaboration
        </Button>
      </SheetTrigger>
      <SheetContent className="flex flex-col gap-0">
        <SheetHeader>
          <SheetTitle>New collaboration</SheetTitle>
          <SheetDescription>
            Adds a row to the campaigns sheet. Payment status and method are
            left blank — fill those in once the deal is actually paid out.
          </SheetDescription>
        </SheetHeader>

        <form
          id="new-collaboration-form"
          onSubmit={handleSubmit}
          className="flex-1 space-y-4 overflow-y-auto px-6"
        >
          <CollaborationFormFields idPrefix="new-collab" form={form} setForm={setForm} />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </form>

        <SheetFooter className="flex-row">
          <SheetClose asChild>
            <Button type="button" variant="outline" className="flex-1">
              Cancel
            </Button>
          </SheetClose>
          <Button
            type="submit"
            form="new-collaboration-form"
            className="flex-1"
            disabled={isPending || !form.brand.trim()}
          >
            {isPending ? "Adding…" : "Add collaboration"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
