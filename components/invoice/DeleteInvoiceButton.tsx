"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { removeInvoice } from "@/app/invoice-generator/actions";

interface DeleteInvoiceButtonProps {
  id: string;
  label: string;
}

export function DeleteInvoiceButton({ id, label }: DeleteInvoiceButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!window.confirm(`Delete invoice ${label}? This can't be undone.`)) return;
    startTransition(async () => {
      await removeInvoice(id);
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className="text-muted-foreground hover:text-destructive"
      disabled={isPending}
      onClick={handleDelete}
      aria-label={`Delete invoice ${label}`}
    >
      <Trash2 />
    </Button>
  );
}
