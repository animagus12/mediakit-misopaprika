"use server";

import { revalidatePath } from "next/cache";
import { publishMediaKitData, saveMediaKitData } from "@/repositories/mediakit.writer.server";
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

// Publishing also saves the draft, so the shared /mediakit page always
// reflects exactly what was on screen when Publish was clicked, even if
// Save was never pressed first.
export async function publishMediaKit(
  data: MediaKitData
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await saveMediaKitData(data);
    await publishMediaKitData(data);
    revalidatePath("/mediakit-generator");
    revalidatePath("/mediakit");
    return { success: true };
  } catch {
    return {
      success: false,
      error: "Couldn't publish — check the server can write to data/mediakit.published.json",
    };
  }
}
