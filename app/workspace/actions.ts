"use server";

import { revalidateStores } from "@/lib/revalidation";
import { recordActivity } from "@/repositories/activity.writer.server";
import { describeChanges } from "@/lib/activityDiff";
import { editorFields, editorTransactionFields } from "@/lib/activityFields";
import { isDayKey } from "@/lib/day";
import { isEditorTransactionStatus, validateEditorTransactionInput } from "@/lib/editorTransactions";
import {
  addEditorTransaction,
  changeEditorTransactionRevisions,
  deleteEditorTransaction,
  renameEditorOnTransactions,
  setEditorTransactionStatus as setEditorTransactionStatusRecord,
  updateEditorTransaction as updateEditorTransactionRecord,
} from "@/repositories/editorTransactions.writer.server";
import type { EditorTransactionUpdate, NewEditorTransaction } from "@/repositories/editorTransactions";
import { addEditor, getEditors, updateEditor as updateEditorRecord } from "@/repositories/editors.writer.server";
import type { EditorUpdate, NewEditor } from "@/repositories/editors";
import { addTrashEntry, activateTrashEntry, removeTrashEntry } from "@/repositories/trash.writer.server";
import { getEditorTransactionRecord } from "@/repositories/editorTransactions.writer.server";
import { requireSession } from "@/lib/session.server";

export async function createEditor(
  input: NewEditor
): Promise<{ success: true } | { success: false; error: string }> {
  const denied = await requireSession();
  if (denied) return denied;

  try {
    await addEditor(input);
    revalidateStores("editors");
    await recordActivity({
      action: "editor.created",
      entity: { type: "editor", id: null, label: input.name.trim() },
    });
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Couldn't save the editor",
    };
  }
}

export async function updateEditor(
  input: EditorUpdate
): Promise<{ success: true } | { success: false; error: string }> {
  const denied = await requireSession();
  if (denied) return denied;

  try {
    // Transactions are filed under the editor's name, so a rename has to carry
    // them along or that editor's history detaches: read the old name before
    // the write, then move anything filed under it.
    // The writer answers both sides of the change, so the old name comes
    // from there rather than from a second read of the editors list.
    const change = await updateEditorRecord(input);
    const previousName = change?.before.name ?? "";
    const moved = await renameEditorOnTransactions(previousName, input.name);
    revalidateStores("editors", "editorTransactions");
    if (change) {
      // A rename is the edit worth calling out by name, since it drags an
      // editor's whole transaction history along with it.
      const renamed = change.before.name !== change.after.name;
      await recordActivity({
        action: renamed ? "editor.renamed" : "editor.updated",
        entity: { type: "editor", id: change.after.id, label: change.after.name },
        detail: renamed
          ? `was ${previousName}, ${moved} transaction${moved === 1 ? "" : "s"} moved`
          : describeChanges(change, editorFields),
      });
    }
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Couldn't save the editor",
    };
  }
}

export async function createEditorTransaction(
  input: NewEditorTransaction
): Promise<{ success: true } | { success: false; error: string }> {
  const denied = await requireSession();
  if (denied) return denied;

  const invalid = validateEditorTransactionInput(input);
  if (invalid) return { success: false, error: invalid };
  try {
    const record = await addEditorTransaction(input);
    revalidateStores("editorTransactions");
    await recordActivity({
      action: "editorTransaction.created",
      entity: { type: "editorTransaction", id: record.id, label: record.video },
      detail: input.editor.trim() || undefined,
      amount: input.amount ?? undefined,
    });
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Couldn't save the transaction",
    };
  }
}

export async function updateEditorTransaction(
  input: EditorTransactionUpdate
): Promise<{ success: true } | { success: false; error: string }> {
  const denied = await requireSession();
  if (denied) return denied;

  const invalid = validateEditorTransactionInput(input);
  if (invalid) return { success: false, error: invalid };
  try {
    const change = await updateEditorTransactionRecord(input);
    revalidateStores("editorTransactions");
    if (change) {
      await recordActivity({
        action: "editorTransaction.updated",
        entity: { type: "editorTransaction", id: change.after.id, label: change.after.video },
        detail: describeChanges(change, editorTransactionFields) ?? (change.after.editor || undefined),
        amount: change.after.amount ?? undefined,
      });
    }
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Couldn't save the transaction",
    };
  }
}

/**
 * `restorePaidDate` (yyyy-mm-dd, or "" for none) is only sent by Undo, to put
 * back the paid date the change being undone cleared rather than stamping
 * today's.
 */
export async function setEditorTransactionStatus(
  id: string,
  status: string,
  restorePaidDate?: string
): Promise<{ success: true } | { success: false; error: string }> {
  const denied = await requireSession();
  if (denied) return denied;

  if (typeof status !== "string" || !isEditorTransactionStatus(status)) {
    return { success: false, error: "Pick a status" };
  }
  const restoreIsValid =
    restorePaidDate === undefined ||
    (typeof restorePaidDate === "string" && (restorePaidDate === "" || isDayKey(restorePaidDate)));
  if (!restoreIsValid) return { success: false, error: "Enter a valid paid date" };
  try {
    const change = await setEditorTransactionStatusRecord(id, status, restorePaidDate);
    if (!change) return { success: false, error: "That transaction no longer exists" };
    revalidateStores("editorTransactions");
    const detail = describeChanges(change, editorTransactionFields);
    // Picking the status it already had logs nothing.
    if (detail) {
      await recordActivity({
        action: "editorTransaction.updated",
        entity: { type: "editorTransaction", id: change.after.id, label: change.after.video },
        detail,
        amount: change.after.amount ?? undefined,
      });
    }
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Couldn't save the status",
    };
  }
}

/**
 * One revision more (delta 1) or less (delta -1) on a transaction, charged at
 * its editor's revision rate. Answers what the amount moved by, so the caller
 * can say when nothing was charged because the editor has no rate set.
 */
export async function changeEditorTransactionRevision(
  id: string,
  delta: 1 | -1
): Promise<{ success: true; charged: number } | { success: false; error: string }> {
  const denied = await requireSession();
  if (denied) return denied;

  if (delta !== 1 && delta !== -1) return { success: false, error: "Invalid revision change" };
  try {
    const editors = await getEditors();
    const change = await changeEditorTransactionRevisions(
      id,
      delta,
      (name) => editors.find((editor) => editor.name === name)?.revisionRate ?? 0
    );
    if (!change) return { success: false, error: "That transaction no longer exists" };
    revalidateStores("editorTransactions");
    const detail = describeChanges(change, editorTransactionFields);
    if (detail) {
      await recordActivity({
        action: "editorTransaction.updated",
        entity: { type: "editorTransaction", id: change.after.id, label: change.after.video },
        detail,
        amount: change.after.amount ?? undefined,
      });
    }
    return { success: true, charged: (change.after.amount ?? 0) - (change.before.amount ?? 0) };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Couldn't save the revision",
    };
  }
}

export async function removeEditorTransaction(
  id: string
): Promise<{ success: true; trashId?: string } | { success: false; error: string }> {
  const denied = await requireSession();
  if (denied) return denied;

  let trashId: string | null = null;
  let removed: Awaited<ReturnType<typeof deleteEditorTransaction>> = null;
  try {
    const record = await getEditorTransactionRecord(id);
    if (!record) return { success: true };
    trashId = await addTrashEntry({ type: "editorTransaction", record }, record.video);
    removed = await deleteEditorTransaction(id);
    if (!removed) {
      await removeTrashEntry(trashId);
      return { success: true };
    }
    await activateTrashEntry(trashId);
    revalidateStores("editorTransactions");
    if (removed) {
      await recordActivity({
        action: "editorTransaction.deleted",
        entity: { type: "editorTransaction", id: removed.id, label: removed.video },
        detail: removed.editor.trim() || undefined,
        amount: removed.amount ?? undefined,
      });
    }
    return { success: true, trashId: trashId ?? undefined };
  } catch (err) {
    if (trashId) {
      if (removed) await activateTrashEntry(trashId);
      else await removeTrashEntry(trashId);
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "Couldn't remove the transaction",
    };
  }
}
