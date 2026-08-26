"use server";

import { revalidatePath } from "next/cache";
import { saveInvoiceData } from "@/repositories/invoice.writer.server";
import type { InvoiceData } from "@/repositories/invoice";

export async function saveInvoiceDefaults(
  data: InvoiceData
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await saveInvoiceData(data);
    revalidatePath("/invoice-generator");
    return { success: true };
  } catch {
    return { success: false, error: "Couldn't save — check KV_REST_API_URL and KV_REST_API_TOKEN are set" };
  }
}
