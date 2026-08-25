"use server";

import { revalidatePath } from "next/cache";
import { saveMediaKitData } from "@/repositories/mediakit.writer.server";
import type { MediaKitData } from "@/repositories/mediakit";

export async function saveMediaKit(
  data: MediaKitData
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await saveMediaKitData(data);
    revalidatePath("/mediakit-generator");
    return { success: true };
  } catch {
    return { success: false, error: "Couldn't save — check the server can write to data/mediakit.json" };
  }
}
