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
} from "@/components/ui/sheet";
import { TableCell, TableRow } from "@/components/ui/table";
import { toIsoDate } from "@/lib/editorTransactions";
import { formatMoney } from "@/lib/invoice";
import { updateEditorTransaction } from "@/app/workspace/actions";
import {
  EditorTransactionFormFields,
  editorTransactionInputFromForm,
  type EditorTransactionFormState,
} from "./EditorTransactionFormFields";
import { DeleteEditorTransactionButton } from "./DeleteEditorTransactionButton";
import { EditorTransactionStatusSelect } from "./EditorTransactionStatusSelect";
import { useEditorTransactionQuickEdits } from "./useEditorTransactionQuickEdits";
import type { EditorTransaction } from "@/repositories/editorTransactions";
import type { Editor } from "@/repositories/editors";

function formFromTransaction(txn: EditorTransaction): EditorTransactionFormState {
  return {
    video: txn.video,
    videoDate: toIsoDate(txn.videoDate),
    deliveryDate: toIsoDate(txn.deliveryDate),
    amount: txn.amount == null ? "" : String(txn.amount),
    editor: txn.editor,
    status: txn.status,
    revisions: txn.revisions,
    revisionRate: txn.revisionRate,
  };
}

interface EditEditorTransactionSheetProps {
  transaction: EditorTransaction;
  editors: Editor[];
}

export function EditEditorTransactionSheet({ transaction, editors }: EditEditorTransactionSheetProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<EditorTransactionFormState>(() => formFromTransaction(transaction));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const formId = `edit-txn-${transaction.id}`;
  const editorRate = editors.find((editor) => editor.name === transaction.editor)?.revisionRate ?? 0;
  const quick = useEditorTransactionQuickEdits(transaction, editorRate);
  const { view } = quick;

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setForm(formFromTransaction(transaction));
      setError(null);
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateEditorTransaction({
        id: transaction.id,
        ...editorTransactionInputFromForm(form),
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setOpen(false);
    });
  }

  return (
    <>
      {/* The whole row opens the sheet for a pointer; the video name is the
          real button, so the row is reachable and announced from a keyboard. */}
      <TableRow className="cursor-pointer" onClick={() => handleOpenChange(true)}>
        <TableCell className="max-w-48">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              handleOpenChange(true);
            }}
            aria-haspopup="dialog"
            title={transaction.video}
            className="block max-w-full truncate rounded-sm text-left font-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            {transaction.video}
          </button>
        </TableCell>
        <TableCell className="hidden tabular-nums text-muted-foreground md:table-cell">
          {transaction.videoDate}
        </TableCell>
        <TableCell className="tabular-nums text-muted-foreground">
          {transaction.deliveryDate || <span className="text-amber-700 dark:text-amber-400">Not yet</span>}
        </TableCell>
        <TableCell className="hidden text-right tabular-nums text-muted-foreground md:table-cell">
          {transaction.etaDays == null ? "-" : `${transaction.etaDays}d`}
        </TableCell>
        {/* Controls in a row stop the click reaching it, so using one never
            opens the sheet; that includes clicks in their portalled menus. */}
        <TableCell className="py-1 text-right" onClick={(event) => event.stopPropagation()}>
          <div className="inline-flex items-center gap-1">
            <span className="min-w-4 tabular-nums text-muted-foreground">{view.revisions}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-foreground"
              disabled={quick.isPending}
              onClick={() => quick.changeRevisions(1)}
              aria-label={`Add a revision to ${transaction.video}`}
              title="Add a revision"
            >
              <Plus />
            </Button>
          </div>
        </TableCell>
        <TableCell className="text-right tabular-nums">
          {view.amount == null ? "-" : formatMoney(view.amount)}
        </TableCell>
        <TableCell className="text-muted-foreground">{transaction.editor}</TableCell>
        <TableCell className="py-1" onClick={(event) => event.stopPropagation()}>
          <EditorTransactionStatusSelect
            status={view.status}
            video={transaction.video}
            disabled={quick.isPending}
            onChange={(next) => quick.setStatus(next, view.status)}
          />
        </TableCell>
        <TableCell className="py-1" onClick={(event) => event.stopPropagation()}>
          <DeleteEditorTransactionButton id={transaction.id} video={transaction.video} />
        </TableCell>
      </TableRow>

      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent className="flex flex-col gap-0">
          <SheetHeader>
            <SheetTitle>Edit transaction</SheetTitle>
            <SheetDescription>Updates this transaction in the workspace.</SheetDescription>
          </SheetHeader>

          <form id={formId} onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto px-6">
            <EditorTransactionFormFields idPrefix={formId} form={form} setForm={setForm} editors={editors} />
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
              form={formId}
              className="flex-1"
              disabled={isPending || !form.video.trim() || !form.editor.trim()}
            >
              {isPending ? "Saving…" : "Save changes"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
