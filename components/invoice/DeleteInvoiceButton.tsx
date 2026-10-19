"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
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

  // Double-click to arm, then a confirm prompt: deleting an invoice is
  // destructive and the row is otherwise click-to-open, so a single stray
  // click must never remove a record.
  function handleDoubleClick() {
    if (!window.confirm(`You are about to delete invoice ${label}. It can be restored from Trash. Continue?`)) {
      return;
    }
    startTransition(async () => {
      const result = await removeInvoice(id);
      showUndoToast(`Invoice ${label}`, result, restoreTrashItem);
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
      disabled={isPending}
      onDoubleClick={handleDoubleClick}
      title="Double-click to move this invoice to Trash"
      aria-label={`Double-click to move invoice ${label} to Trash`}
    >
      <Trash2 />
    </Button>
  );
}
