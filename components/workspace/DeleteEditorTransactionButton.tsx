"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { removeEditorTransaction } from "@/app/workspace/actions";

interface DeleteEditorTransactionButtonProps {
  id: string;
  video: string;
}

export function DeleteEditorTransactionButton({ id, video }: DeleteEditorTransactionButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!window.confirm(`Remove "${video}" from the workspace?`)) return;
    startTransition(async () => {
      await removeEditorTransaction(id);
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
      aria-label={`Remove ${video}`}
    >
      <Trash2 />
    </Button>
  );
}
