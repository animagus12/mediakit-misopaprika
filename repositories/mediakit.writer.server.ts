import "server-only";
import { promises as fs } from "fs";
import path from "path";
import type { MediaKitData } from "./mediakit";

// Deliberately not re-exported from ./index (the shared repository barrel) —
// AppSideBar and other client components import from that barrel, and any
// module they pull in must stay bundler-safe (no Node built-ins). Writing
// the media kit is a server action-only operation, so its `fs`/`path` usage
// lives here instead, imported directly by the action that needs it.
const MEDIAKIT_JSON_PATH = path.join(process.cwd(), "data", "mediakit.json");

export async function saveMediaKitData(data: MediaKitData): Promise<void> {
  await fs.writeFile(MEDIAKIT_JSON_PATH, JSON.stringify(data, null, 2) + "\n", "utf-8");
}
