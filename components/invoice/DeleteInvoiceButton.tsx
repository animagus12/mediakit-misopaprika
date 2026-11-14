"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { removeInvoice } from "@/app/invoices/actions";
import { restoreTrashItem } from "@/app/trash/actions";
import { showUndoToast } from "@/components/common/undo-toast";

interface DeleteInvoiceButtonProps {
  id: string;
  label: string;
}

export function DeleteInvoiceButton({ id, label }: DeleteInvoiceButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  // Double-click to arm, then a confirm prompt: deleting an invoice is
  // destructive and the row is otherwise click-to-open, so a single stray
  // click must never remove a record.
  function handleDelete() {
    startTransition(async () => {
      const result = await removeInvoice(id);
      showUndoToast(`Invoice ${label}`, result, restoreTrashItem);
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        disabled={isPending}
        onDoubleClick={() => setConfirming(true)}
        title="Double-click to move this invoice to Trash"
        aria-label={`Double-click to move invoice ${label} to Trash`}
      >
        <Trash2 />
      </Button>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete invoice {label}?</AlertDialogTitle>
            <AlertDialogDescription>
              This moves the invoice to Trash, where it can be restored.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
