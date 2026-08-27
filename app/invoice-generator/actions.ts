"use server";

import { revalidatePath } from "next/cache";
import { saveInvoiceData } from "@/repositories/invoice.writer.server";
import {
  addInvoice,
  deleteInvoice,
  updateInvoice as updateInvoiceRecord,
} from "@/repositories/invoices.writer.server";
import type { InvoiceData } from "@/repositories/invoice";
import type { InvoiceUpdate, NewInvoice } from "@/repositories/invoices";

type ActionResult = { success: true } | { success: false; error: string };

function toActionError(err: unknown, fallback: string): { success: false; error: string } {
  return { success: false, error: err instanceof Error ? err.message : fallback };
}

export async function saveInvoiceDefaults(data: InvoiceData): Promise<ActionResult> {
  try {
    await saveInvoiceData(data);
    revalidatePath("/invoice-generator/new");
    return { success: true };
  } catch {
    return { success: false, error: "Couldn't save — check KV_REST_API_URL and KV_REST_API_TOKEN are set" };
  }
}

export async function createInvoice(
  input: NewInvoice
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  try {
    const record = await addInvoice(input);
    revalidatePath("/invoice-generator");
    return { success: true, id: record.id };
  } catch (err) {
    return toActionError(err, "Couldn't save the invoice");
  }
}

export async function updateInvoice(input: InvoiceUpdate): Promise<ActionResult> {
  try {
    await updateInvoiceRecord(input);
    revalidatePath("/invoice-generator");
    revalidatePath(`/invoice-generator/${input.id}`);
    return { success: true };
  } catch (err) {
    return toActionError(err, "Couldn't save the invoice");
  }
}

export async function removeInvoice(id: string): Promise<ActionResult> {
  try {
    await deleteInvoice(id);
    revalidatePath("/invoice-generator");
    return { success: true };
  } catch (err) {
    return toActionError(err, "Couldn't remove the invoice");
  }
}
