"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button, type buttonVariants } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";
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
import {
  EditorTransactionFormFields,
  editorTransactionInitialForm,
  editorTransactionInputFromForm,
} from "./EditorTransactionFormFields";
import type { Editor } from "@/repositories/editors";

interface NewEditorTransactionButtonProps {
  // Defaults to the primary solid button: /workspace's own "New transaction" CTA.
  // Dashboard QuickActions passes "outline" so New campaign stays the one
  // prominent action in that row.
  variant?: VariantProps<typeof buttonVariants>["variant"];
  editors: Editor[];
}

export function NewEditorTransactionButton({ editors, variant = "default" }: NewEditorTransactionButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <NewEditorTransactionSheet
      open={open}
      onOpenChange={setOpen}
      editors={editors}
      trigger={
        <Button size="sm" variant={variant}>
          <Plus className="size-3.5" />
          New transaction
        </Button>
      }
    />
  );
}

interface NewEditorTransactionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The button that opens it, when it has one. The shell's New menu opens it without. */
  trigger?: React.ReactElement;
  editors: Editor[];
}

// Controlled, so the page's own button and the shell's New menu open the one form.
export function NewEditorTransactionSheet({
  open,
  onOpenChange,
  trigger,
  editors,
}: NewEditorTransactionSheetProps) {
  const [form, setForm] = useState(() => editorTransactionInitialForm(editors));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createEditorTransaction(editorTransactionInputFromForm(form));
      if (!result.success) {
        setError(result.error);
        return;
      }
      setForm(editorTransactionInitialForm(editors));
      handleOpenChange(false);
    });
  }

  // Cleared on the way out: an opening from the New menu never passes through here.
  function handleOpenChange(next: boolean) {
    if (!next) setError(null);
    onOpenChange(next);
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      {trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}
      <SheetContent className="flex flex-col gap-0">
        <SheetHeader>
          <SheetTitle>New transaction</SheetTitle>
          <SheetDescription>
            A video handed to an editor. It starts Pending with no delivery date; log those on the
            transaction when the cut comes back.
          </SheetDescription>
        </SheetHeader>

        <form
          id="new-editor-transaction-form"
          onSubmit={handleSubmit}
          className="flex-1 space-y-4 overflow-y-auto px-6"
        >
          <EditorTransactionFormFields
            idPrefix="new-txn"
            mode="create"
            form={form}
            setForm={setForm}
            editors={editors}
          />
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
