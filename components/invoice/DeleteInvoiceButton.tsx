"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { removeInvoice } from "@/app/invoices/actions";

interface DeleteInvoiceButtonProps {
  id: string;
  label: string;
}

export function DeleteInvoiceButton({ id, label }: DeleteInvoiceButtonProps) {
  const [isPending, startTransition] = useTransition();

  // Double-click to arm, then a confirm prompt — deleting an invoice is
  // destructive and the row is otherwise click-to-open, so a single stray
  // click must never remove a record.
  function handleDoubleClick() {
    if (!window.confirm(`You are about to delete invoice ${label}. This can't be undone. Continue?`)) {
      return;
    }
    startTransition(async () => {
      await removeInvoice(id);
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
      title="Double-click to delete this invoice"
      aria-label={`Double-click to delete invoice ${label}`}
    >
      <Trash2 />
    </Button>
  );
}
