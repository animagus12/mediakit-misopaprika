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
import { createEditorTransaction } from "@/app/workspace/actions";
import { EditorTransactionFormFields, editorTransactionInitialForm } from "./EditorTransactionFormFields";
import type { Editor } from "@/repositories/editors";

interface NewEditorTransactionButtonProps {
  editors: Editor[];
}

export function NewEditorTransactionButton({ editors }: NewEditorTransactionButtonProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => editorTransactionInitialForm(editors));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createEditorTransaction({
        video: form.video.trim(),
        videoDate: form.videoDate,
        deliveryDate: form.deliveryDate,
        amount: form.amount === "" ? null : Number(form.amount),
        editor: form.editor.trim(),
        status: form.status,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setForm(editorTransactionInitialForm(editors));
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
          New transaction
        </Button>
      </SheetTrigger>
      <SheetContent className="flex flex-col gap-0">
        <SheetHeader>
          <SheetTitle>New transaction</SheetTitle>
        </SheetHeader>

        <form
          id="new-editor-transaction-form"
          onSubmit={handleSubmit}
          className="flex-1 space-y-4 overflow-y-auto px-6"
        >
          <EditorTransactionFormFields idPrefix="new-txn" form={form} setForm={setForm} editors={editors} />
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
            form="new-editor-transaction-form"
            className="flex-1"
            disabled={isPending || !form.video.trim() || !form.editor.trim()}
          >
            {isPending ? "Adding…" : "Add transaction"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
