"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { removeAffiliatePayout } from "@/app/affiliates/actions";
import { restoreTrashItem } from "@/app/trash/actions";
import { showUndoToast } from "@/components/common/undo-toast";

interface DeletePayoutButtonProps {
  id: string;
  label: string;
}

export function DeletePayoutButton({ id, label }: DeletePayoutButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!window.confirm(`Remove the ${label} payout?`)) return;
    startTransition(async () => {
      const result = await removeAffiliatePayout(id);
      showUndoToast(`Payout ${label}`, result, restoreTrashItem);
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
      aria-label={`Remove ${label} payout`}
    >
      <Trash2 />
    </Button>
  );
}
