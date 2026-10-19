"use client";

import { toast } from "sonner";

export type DeletionResult =
  | { success: true; trashId?: string }
  | { success: false; error: string };

export function showUndoToast(
  label: string,
  result: DeletionResult,
  restore: (trashId: string) => Promise<{ success: true } | { success: false; error: string }>
): void {
  if (!result.success) {
    toast.error(`Couldn't delete ${label}`, { description: result.error });
    return;
  }
  if (!result.trashId) {
    return;
  }

  const trashId = result.trashId;
  toast.success(`${label} moved to Trash`, {
    action: {
      label: "Undo",
      onClick: () => {
        void restore(trashId).then((undoResult) => {
          if (undoResult.success) toast.success(`${label} restored`);
          else toast.error("Couldn't restore", { description: undoResult.error });
        }).catch((error: unknown) => {
          toast.error("Couldn't restore", {
            description: error instanceof Error ? error.message : "Please try again.",
          });
        });
      },
    },
  });
}
