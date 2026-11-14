"use server";

import { revalidatePath } from "next/cache";
import { publishMediaKitData, saveMediaKitData } from "@/repositories/mediakit.writer.server";
import { recordActivity } from "@/repositories/activity.writer.server";
import type { MediaKitData } from "@/repositories/mediakit";
import { parseMediaKitData } from "@/lib/mediakit";
import { requireSession } from "@/lib/session.server";

// The store's own message: an unconfigured one already names the env vars
// (see requireRedis), and any other failure is reported as what it was.
function failure(verb: string, err: unknown): { success: false; error: string } {
  return { success: false, error: `Couldn't ${verb}: ${err instanceof Error ? err.message : "try again"}` };
}

// What either action answers when the media kit it was sent isn't one it can keep.
function invalidMediaKit(verb: string): { success: false; error: string } {
  return { success: false, error: `Couldn't ${verb}: the editor sent a media kit it can't store. Reload and try again.` };
}

export async function saveMediaKit(
  data: MediaKitData
): Promise<{ success: true } | { success: false; error: string }> {
  const denied = await requireSession();
  if (denied) return denied;

  const kit = parseMediaKitData(data);
  if (!kit) return invalidMediaKit("save");

  try {
    await saveMediaKitData(kit);
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

  const kit = parseMediaKitData(data);
  if (!kit) return invalidMediaKit("publish");

  try {
    await saveMediaKitData(kit);
    await publishMediaKitData(kit);
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
