"use client";

import { useState, useTransition } from "react";
import { Badge, type badgeVariants } from "@/components/ui/badge";
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
import type { VariantProps } from "class-variance-authority";
import { toIsoDate } from "@/lib/editorTransactions";
import { formatMoney } from "@/lib/invoice";
import { updateEditorTransaction } from "@/app/workspace/actions";
import {
  EditorTransactionFormFields,
  type EditorTransactionFormState,
} from "./EditorTransactionFormFields";
import { DeleteEditorTransactionButton } from "./DeleteEditorTransactionButton";
import type { EditorTransaction } from "@/repositories/editorTransactions";
import type { Editor } from "@/repositories/editors";

interface StatusStyle {
  variant: VariantProps<typeof badgeVariants>["variant"];
  className?: string;
}

function statusStyle(status: string): StatusStyle {
  switch (status.toLowerCase()) {
    case "paid":
      return {
        variant: "outline",
        className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
      };
    case "cancelled":
      return { variant: "destructive" };
    case "pending":
      return {
        variant: "outline",
        className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
      };
    default:
      return { variant: "secondary" };
  }
}

function formFromTransaction(txn: EditorTransaction): EditorTransactionFormState {
  return {
    video: txn.video,
    videoDate: toIsoDate(txn.videoDate),
    deliveryDate: toIsoDate(txn.deliveryDate),
    amount: txn.amount == null ? "" : String(txn.amount),
    editor: txn.editor,
    status: txn.status,
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
  const status = statusStyle(transaction.status);

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
      setOpen(false);
    });
  }

  return (
    <>
      <TableRow className="cursor-pointer" onClick={() => handleOpenChange(true)}>
        <TableCell className="max-w-40 truncate font-medium">{transaction.video}</TableCell>
        <TableCell className="text-muted-foreground">{transaction.videoDate}</TableCell>
        <TableCell className="text-muted-foreground">{transaction.deliveryDate}</TableCell>
        <TableCell className="text-right tabular-nums text-muted-foreground">{transaction.etaDays}d</TableCell>
        <TableCell className="text-right tabular-nums">
          {transaction.amount == null ? "-" : formatMoney(transaction.amount)}
        </TableCell>
        <TableCell className="text-muted-foreground">{transaction.editor}</TableCell>
        <TableCell>
          <Badge variant={status.variant} className={status.className}>
            {transaction.status}
          </Badge>
        </TableCell>
        <TableCell onClick={(event) => event.stopPropagation()}>
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
