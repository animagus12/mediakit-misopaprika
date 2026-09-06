"use server";

import { revalidatePath } from "next/cache";
import { publishLinksData, saveLinksData } from "@/repositories/links.writer.server";
import type { LinksData } from "@/repositories/links";

type ActionResult = { success: true } | { success: false; error: string };

const REDIS_HINT = "check KV_REST_API_URL and KV_REST_API_TOKEN are set";

export async function saveLinks(data: LinksData): Promise<ActionResult> {
  try {
    await saveLinksData(data);
    revalidatePath("/links-editor");
    return { success: true };
  } catch {
    return { success: false, error: `Couldn't save: ${REDIS_HINT}` };
  }
}

// Publishing also saves the draft, so /links always reflects exactly what was
// on screen when Publish was clicked even if Save was never pressed: same
// contract as publishMediaKit.
export async function publishLinks(data: LinksData): Promise<ActionResult> {
  try {
    await saveLinksData(data);
    await publishLinksData(data);
    revalidatePath("/links-editor");
    revalidatePath("/links");
    return { success: true };
  } catch {
    return { success: false, error: `Couldn't publish: ${REDIS_HINT}` };
  }
}
