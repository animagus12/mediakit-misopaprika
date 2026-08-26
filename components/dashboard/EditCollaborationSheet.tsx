"use client";

import { useState, useTransition, type ReactNode } from "react";
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
import { updateCollaboration } from "@/app/(dashboard)/actions";
import { CollaborationFormFields, type CollaborationFormState } from "./CollaborationFormFields";
import { REEL_OPTIONS, STORY_OPTIONS, COLLABORATION_TYPES, toIsoDate } from "@/lib/collaborations";
import type { Collaboration } from "@/repositories/collaborations";

function formFromCollaboration(collab: Collaboration): CollaborationFormState {
  return {
    brand: collab.brand,
    campaign: collab.campaign,
    type: COLLABORATION_TYPES.includes(collab.type as (typeof COLLABORATION_TYPES)[number])
      ? (collab.type as CollaborationFormState["type"])
      : "Barter",
    reels: collab.reels || REEL_OPTIONS[0],
    story: collab.story || STORY_OPTIONS[0],
    status: collab.status,
    amount: collab.amount > 0 ? String(collab.amount) : "",
    barterValue: collab.barterValue > 0 ? String(collab.barterValue) : "",
    date: toIsoDate(collab.date) || new Date().toISOString().slice(0, 10),
  };
}

export function EditCollaborationSheet({
  collaboration,
  trigger,
}: {
  collaboration: Collaboration;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CollaborationFormState>(() => formFromCollaboration(collaboration));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const formId = `edit-collab-${collaboration.id}`;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateCollaboration({
        id: collaboration.id,
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
      setOpen(false);
    });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setForm(formFromCollaboration(collaboration));
          setError(null);
        }
      }}
    >
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="flex flex-col gap-0">
        <SheetHeader>
          <SheetTitle>Edit collaboration</SheetTitle>
          <SheetDescription>Updates the matching row in the campaigns sheet.</SheetDescription>
        </SheetHeader>

        <form id={formId} onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto px-6">
          <CollaborationFormFields idPrefix={formId} form={form} setForm={setForm} />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </form>

        <SheetFooter className="flex-row">
          <SheetClose asChild>
            <Button type="button" variant="outline" className="flex-1">
              Cancel
            </Button>
          </SheetClose>
          <Button type="submit" form={formId} className="flex-1" disabled={isPending || !form.brand.trim()}>
            {isPending ? "Saving…" : "Save changes"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
