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
import { createEditor } from "@/app/workspace/actions";
import { EditorFormFields, editorInitialForm } from "./EditorFormFields";

export function NewEditorButton() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(editorInitialForm);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createEditor({
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        upi: form.upi.trim(),
        qrImage: form.qrImage,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setForm(editorInitialForm());
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
          Add editor
        </Button>
      </SheetTrigger>
      <SheetContent className="flex flex-col gap-0">
        <SheetHeader>
          <SheetTitle>Add editor</SheetTitle>
          <SheetDescription>Adds an editor to the workspace so they can be tagged on transactions.</SheetDescription>
        </SheetHeader>

        <form id="new-editor-form" onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto px-6">
          <EditorFormFields idPrefix="new-editor" form={form} setForm={setForm} onUploadError={setError} />
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
            form="new-editor-form"
            className="flex-1"
            disabled={isPending || !form.name.trim()}
          >
            {isPending ? "Adding…" : "Add editor"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
