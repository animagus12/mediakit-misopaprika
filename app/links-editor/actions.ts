"use server";

import { revalidatePath } from "next/cache";
import { publishLinksData, saveLinksData } from "@/repositories/links.writer.server";
import { recordActivity } from "@/repositories/activity.writer.server";
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
    revalidatePath("/");
    // Publishing is logged; saving a draft is not. Save fires on ordinary
    // editing and would bury everything else in the feed, while publish is
    // the moment the public page changed, which is the thing worth being
    // able to date afterwards.
    const items = data.sections.reduce((count, section) => count + section.items.length, 0);
    await recordActivity({
      action: "links.published",
      entity: { type: "links", id: null, label: "" },
      detail: `${data.sections.length} section${data.sections.length === 1 ? "" : "s"}, ${items} link${items === 1 ? "" : "s"}`,
    });
    return { success: true };
  } catch {
    return { success: false, error: `Couldn't publish: ${REDIS_HINT}` };
  }
}
