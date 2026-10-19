"use server";

import { revalidatePath } from "next/cache";
import { publishLinksData, saveLinksData } from "@/repositories/links.writer.server";
import { recordActivity } from "@/repositories/activity.writer.server";
import type { LinksData } from "@/repositories/links";
import type { LinkTrashDeletion, LinkTrashTarget, TrashPayload } from "@/repositories/trash";
import {
  activateTrashEntry,
  addTrashEntry,
  removeTrashEntry,
  setTrashEntryTargets,
} from "@/repositories/trash.writer.server";

type ActionResult =
  | { success: true; trashIds: string[]; warning?: string }
  | { success: false; error: string };

const REDIS_HINT = "check KV_REST_API_URL and KV_REST_API_TOKEN are set";

async function saveWithTrash(
  data: LinksData,
  deletions: LinkTrashDeletion[],
  targets: LinkTrashTarget[],
  publish: boolean
): Promise<ActionResult> {
  const trashIds: string[] = [];
  let draftSaved = false;
  let published = false;
  try {
    for (const deletion of deletions) {
      const payload: TrashPayload = { ...deletion, targets };
      trashIds.push(await addTrashEntry(payload, deletion.label));
    }
    await saveLinksData(data);
    draftSaved = true;
    if (publish) {
      await publishLinksData(data);
      published = true;
    }
    for (const id of trashIds) await activateTrashEntry(id);
    return { success: true, trashIds };
  } catch (err) {
    if (draftSaved) {
      for (const id of trashIds) {
        await setTrashEntryTargets(
          id,
          publish && published ? ["draft", "published"] : ["draft"]
        );
        await activateTrashEntry(id);
      }
      return {
        success: true,
        trashIds,
        warning:
          publish && !published
            ? "The draft was saved, but publishing failed. The removed links are available in Trash."
            : "Your changes were saved, but the Trash snapshot could not be finalized.",
      };
    } else {
      for (const id of trashIds) await removeTrashEntry(id);
    }
    throw err;
  }
}

export async function saveLinks(data: LinksData, deletions: LinkTrashDeletion[] = []): Promise<ActionResult> {
  try {
    const result = await saveWithTrash(data, deletions, ["draft"], false);
    revalidatePath("/links-editor");
    return result;
  } catch {
    return { success: false, error: `Couldn't save: ${REDIS_HINT}` };
  }
}

// Publishing also saves the draft, so /links always reflects exactly what was
// on screen when Publish was clicked even if Save was never pressed: same
// contract as publishMediaKit.
export async function publishLinks(data: LinksData, deletions: LinkTrashDeletion[] = []): Promise<ActionResult> {
  try {
    const result = await saveWithTrash(data, deletions, ["draft", "published"], true);
    if (!result.success) return result;
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
    return result;
  } catch {
    return { success: false, error: `Couldn't publish: ${REDIS_HINT}` };
  }
}
