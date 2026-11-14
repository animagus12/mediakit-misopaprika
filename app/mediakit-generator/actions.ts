"use server";

import { revalidatePath } from "next/cache";
import { publishMediaKitData, saveMediaKitData } from "@/repositories/mediakit.writer.server";
import { recordActivity } from "@/repositories/activity.writer.server";
import type { MediaKitData } from "@/repositories/mediakit";
import { requireSession } from "@/lib/session.server";

// The store's own message: an unconfigured one already names the env vars
// (see requireRedis), and any other failure is reported as what it was.
function failure(verb: string, err: unknown): { success: false; error: string } {
  return { success: false, error: `Couldn't ${verb}: ${err instanceof Error ? err.message : "try again"}` };
}

export async function saveMediaKit(
  data: MediaKitData
): Promise<{ success: true } | { success: false; error: string }> {
  const denied = await requireSession();
  if (denied) return denied;

  try {
    await saveMediaKitData(data);
    revalidatePath("/mediakit-generator");
    revalidatePath("/", "layout");
    return { success: true };
  } catch (err) {
    return failure("save", err);
  }
}

// Publishing also saves the draft, so the shared /mediakit page always
// reflects exactly what was on screen when Publish was clicked, even if
// Save was never pressed first.
export async function publishMediaKit(
  data: MediaKitData
): Promise<{ success: true } | { success: false; error: string }> {
  const denied = await requireSession();
  if (denied) return denied;

  try {
    await saveMediaKitData(data);
    await publishMediaKitData(data);
    revalidatePath("/mediakit-generator");
    revalidatePath("/mediakit");
    revalidatePath("/", "layout");
    // Publish only, not save: same reasoning as publishLinks.
    await recordActivity({
      action: "mediakit.published",
      entity: { type: "mediakit", id: null, label: "" },
    });
    return { success: true };
  } catch (err) {
    return failure("publish", err);
  }
}
