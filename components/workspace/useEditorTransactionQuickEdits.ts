"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { changeEditorTransactionRevision, setEditorTransactionStatus } from "@/app/workspace/actions";
import { applyRevisionChange } from "@/lib/editorTransactions";
import { formatMoney } from "@/lib/invoice";
import type { EditorTransaction } from "@/repositories/editorTransactions";

type QuickEdit = { type: "status"; status: string } | { type: "revisions"; delta: 1 | -1 };

/**
 * The two edits the transactions table makes without opening the sheet:
 * status and revision count. Both show at once and settle when the server
 * answers, with an Undo on the toast, the same shape as ContentStatusSelect.
 *
 * `editorRate` only drives the optimistic amount. The write looks the rate up
 * again on the server, so a stale roster can't charge the wrong figure.
 */
export function useEditorTransactionQuickEdits(transaction: EditorTransaction, editorRate: number) {
  const [isPending, startTransition] = useTransition();
  const [view, applyOptimistic] = useOptimistic(transaction, (state, edit: QuickEdit) =>
    edit.type === "status"
      ? { ...state, status: edit.status }
      : { ...state, ...applyRevisionChange(state, edit.delta, editorRate) }
  );

  function setStatus(nextStatus: string, previousStatus: string, isUndo = false) {
    if (nextStatus === previousStatus) return;
    startTransition(async () => {
      applyOptimistic({ type: "status", status: nextStatus });
      const result = await setEditorTransactionStatus(transaction.id, nextStatus);
      if (!result.success) {
        toast.error("Couldn't update status", { description: result.error });
        return;
      }
      if (!isUndo) {
        toast.success(`${transaction.video} marked ${nextStatus}`, {
          action: { label: "Undo", onClick: () => setStatus(previousStatus, nextStatus, true) },
        });
      }
    });
  }

  function changeRevisions(delta: 1 | -1, isUndo = false) {
    startTransition(async () => {
      applyOptimistic({ type: "revisions", delta });
      const result = await changeEditorTransactionRevision(transaction.id, delta);
      if (!result.success) {
        toast.error("Couldn't update revisions", { description: result.error });
        return;
      }
      if (!isUndo) {
        toast.success(`Revision added to ${transaction.video}`, {
          description:
            result.charged !== 0
              ? `${formatMoney(result.charged)} added to the amount`
              : `No revision rate set for ${transaction.editor}, so the amount is unchanged`,
          action: { label: "Undo", onClick: () => changeRevisions(-delta as 1 | -1, true) },
        });
      }
    });
  }

  return { view, isPending, setStatus, changeRevisions };
}
