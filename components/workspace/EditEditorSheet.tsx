"use client";

import { useMemo, useState, useTransition } from "react";
import { badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { computeEditorPayoutSummary } from "@/lib/editorTransactions";
import { formatMoney } from "@/lib/invoice";
import { cn } from "@/lib/utils";
import { updateEditor } from "@/app/workspace/actions";
import { EditorFormFields, type EditorFormState } from "./EditorFormFields";
import type { EditorTransaction } from "@/repositories/editorTransactions";
import type { Editor } from "@/repositories/editors";

// Cycled by roster position so each editor's chip stays visually distinct
// at a glance, independent of what their name happens to be.
const EDITOR_DOT_COLORS = [
  "bg-sky-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-rose-500",
  "bg-cyan-500",
];

function formFromEditor(editor: Editor): EditorFormState {
  return {
    name: editor.name,
    phone: editor.phone,
    email: editor.email,
    upi: editor.upi,
    qrImage: editor.qrImage,
  };
}

interface EditEditorSheetProps {
  editor: Editor;
  transactions: EditorTransaction[];
  colorIndex?: number;
}

export function EditEditorSheet({ editor, transactions, colorIndex = 0 }: EditEditorSheetProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<EditorFormState>(() => formFromEditor(editor));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const formId = `edit-editor-${editor.id}`;
  const payout = useMemo(
    () => computeEditorPayoutSummary(editor.name, transactions),
    [editor.name, transactions]
  );

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setForm(formFromEditor(editor));
      setError(null);
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateEditor({
        id: editor.id,
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
      setOpen(false);
    });
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => handleOpenChange(true)}
            className={cn(
              badgeVariants({ variant: "secondary" }),
              "h-6 cursor-pointer px-2.5 text-xs transition hover:bg-secondary/70"
            )}
          >
            <span className={cn("size-1.5 shrink-0 rounded-full", EDITOR_DOT_COLORS[colorIndex % EDITOR_DOT_COLORS.length])} />
            {editor.name}
          </button>
        </TooltipTrigger>
        <TooltipContent className="flex-col items-start gap-1 p-3">
          <p className="font-medium">{formatMoney(payout.paid)} paid</p>
          {payout.pending > 0 && <p>{formatMoney(payout.pending)} pending</p>}
          {editor.phone && <p>{editor.phone}</p>}
          {editor.email && <p>{editor.email}</p>}
          {editor.upi && <p>{editor.upi}</p>}
          {!editor.phone && !editor.email && !editor.upi && !editor.qrImage && <p>No contact info on file</p>}
          {editor.qrImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={editor.qrImage}
              alt={`${editor.name}'s UPI QR code`}
              className="mt-1 size-24 rounded-sm bg-white object-contain p-1"
            />
          )}
        </TooltipContent>
      </Tooltip>

      <SheetContent className="flex flex-col gap-0">
        <SheetHeader>
          <SheetTitle>Edit editor</SheetTitle>
        </SheetHeader>

        <div className="grid grid-cols-2 gap-3 px-6 pb-4">
          <Card size="sm" className="bg-emerald-500/5 ring-emerald-500/15">
            <CardHeader>
              <CardDescription>Paid so far</CardDescription>
              <CardTitle className="text-base tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatMoney(payout.paid)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card size="sm" className="bg-amber-500/5 ring-amber-500/15">
            <CardHeader>
              <CardDescription>Pending</CardDescription>
              <CardTitle className="text-base tabular-nums text-amber-600 dark:text-amber-400">
                {formatMoney(payout.pending)}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <form id={formId} onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto px-6">
          <EditorFormFields idPrefix={formId} form={form} setForm={setForm} onUploadError={setError} />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </form>

        <SheetFooter className="flex-row">
          <SheetClose asChild>
            <Button type="button" variant="outline" className="flex-1">
              Close
            </Button>
          </SheetClose>
          <Button type="submit" form={formId} className="flex-1" disabled={isPending || !form.name.trim()}>
            {isPending ? "Saving…" : "Save changes"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
