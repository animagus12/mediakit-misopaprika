"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { removeAffiliatePayout } from "@/app/affiliates/actions";

interface DeletePayoutButtonProps {
  id: string;
  label: string;
}

export function DeletePayoutButton({ id, label }: DeletePayoutButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!window.confirm(`Remove the ${label} payout?`)) return;
    startTransition(async () => {
      await removeAffiliatePayout(id);
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
