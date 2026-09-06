"use server";

import { revalidateStores } from "@/lib/revalidation";
import {
  addEditorTransaction,
  deleteEditorTransaction,
  renameEditorOnTransactions,
  updateEditorTransaction as updateEditorTransactionRecord,
} from "@/repositories/editorTransactions.writer.server";
import type { EditorTransactionUpdate, NewEditorTransaction } from "@/repositories/editorTransactions";
import {
  addEditor,
  getEditors,
  updateEditor as updateEditorRecord,
} from "@/repositories/editors.writer.server";
import type { EditorUpdate, NewEditor } from "@/repositories/editors";

export async function createEditor(
  input: NewEditor
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await addEditor(input);
    revalidateStores("editors");
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
    const previousName = (await getEditors()).find((editor) => editor.id === input.id)?.name ?? "";
    await updateEditorRecord(input);
    await renameEditorOnTransactions(previousName, input.name);
    revalidateStores("editors", "editorTransactions");
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
    await updateEditorTransactionRecord(input);
    revalidateStores("editorTransactions");
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
    await deleteEditorTransaction(id);
    revalidateStores("editorTransactions");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Couldn't remove the transaction",
    };
  }
}
