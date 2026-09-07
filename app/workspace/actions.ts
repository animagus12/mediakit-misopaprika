"use server";

import { revalidateStores } from "@/lib/revalidation";
import { recordActivity } from "@/repositories/activity.writer.server";
import { describeChanges } from "@/lib/activityDiff";
import { editorFields, editorTransactionFields } from "@/lib/activityFields";
import {
  addEditorTransaction,
  deleteEditorTransaction,
  renameEditorOnTransactions,
  updateEditorTransaction as updateEditorTransactionRecord,
} from "@/repositories/editorTransactions.writer.server";
import type { EditorTransactionUpdate, NewEditorTransaction } from "@/repositories/editorTransactions";
import { addEditor, updateEditor as updateEditorRecord } from "@/repositories/editors.writer.server";
import type { EditorUpdate, NewEditor } from "@/repositories/editors";

export async function createEditor(
  input: NewEditor
): Promise<{ success: true } | { success: false; error: string }> {
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
  try {
    await addEditorTransaction(input);
    revalidateStores("editorTransactions");
    await recordActivity({
      action: "editorTransaction.created",
      entity: { type: "editorTransaction", id: null, label: input.video.trim() },
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

export async function removeEditorTransaction(
  id: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const removed = await deleteEditorTransaction(id);
    revalidateStores("editorTransactions");
    if (removed) {
      await recordActivity({
        action: "editorTransaction.deleted",
        entity: { type: "editorTransaction", id: removed.id, label: removed.video },
        detail: removed.editor.trim() || undefined,
        amount: removed.amount ?? undefined,
      });
    }
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Couldn't remove the transaction",
    };
  }
}
