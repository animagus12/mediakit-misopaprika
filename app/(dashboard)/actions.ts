"use server";

import { revalidatePath } from "next/cache";
import { collaborationRepository } from "@/repositories/collaborations";
import type { NewCollaboration } from "@/repositories/collaborations";

export async function createCollaboration(
  input: NewCollaboration
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await collaborationRepository.create(input);
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Couldn't save to the sheet",
    };
  }
}
