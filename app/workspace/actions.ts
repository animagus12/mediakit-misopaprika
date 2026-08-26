"use server";

import { revalidatePath } from "next/cache";
import {
  addEditorTransaction,
  deleteEditorTransaction,
  updateEditorTransaction as updateEditorTransactionRecord,
} from "@/repositories/editorTransactions.writer.server";
import type { EditorTransactionUpdate, NewEditorTransaction } from "@/repositories/editorTransactions";
import {
  addEditor,
  updateEditor as updateEditorRecord,
} from "@/repositories/editors.writer.server";
import type { EditorUpdate, NewEditor } from "@/repositories/editors";

export async function createEditor(
  input: NewEditor
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await addEditor(input);
    revalidatePath("/workspace");
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
    await updateEditorRecord(input);
    revalidatePath("/workspace");
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
    revalidatePath("/workspace");
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
    revalidatePath("/workspace");
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
    revalidatePath("/workspace");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Couldn't remove the transaction",
    };
  }
}
