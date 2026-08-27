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
    revalidatePath("/invoices/new");
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
    revalidatePath("/invoices");
    // The dashboard's "Needs attention" card clears a "no invoice raised" row
    // once a matching invoice exists, so it has to re-read the invoices store.
    revalidatePath("/");
    return { success: true, id: record.id };
  } catch (err) {
    return toActionError(err, "Couldn't save the invoice");
  }
}

export async function updateInvoice(input: InvoiceUpdate): Promise<ActionResult> {
  try {
    await updateInvoiceRecord(input);
    revalidatePath("/invoices");
    revalidatePath(`/invoices/${input.id}`);
    // Keep the dashboard's "Needs attention" card in sync — an edit can change
    // the brand/campaign an invoice is matched on, or void it.
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return toActionError(err, "Couldn't save the invoice");
  }
}

export async function removeInvoice(id: string): Promise<ActionResult> {
  try {
    await deleteInvoice(id);
    revalidatePath("/invoices");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return toActionError(err, "Couldn't remove the invoice");
  }
}
