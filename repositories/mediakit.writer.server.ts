import "server-only";
import { promises as fs } from "fs";
import path from "path";
import type { MediaKitData } from "./mediakit";

// Deliberately not re-exported from ./index (the shared repository barrel) —
// AppSideBar and other client components import from that barrel, and any
// module they pull in must stay bundler-safe (no Node built-ins). Reading/
// writing the media kit's draft and published snapshots is a server-only
// operation, so that `fs`/`path` usage lives here instead, imported directly
// by the server actions and the public /mediakit page that need it.
const MEDIAKIT_JSON_PATH = path.join(process.cwd(), "data", "mediakit.json");
const MEDIAKIT_PUBLISHED_JSON_PATH = path.join(process.cwd(), "data", "mediakit.published.json");

export async function saveMediaKitData(data: MediaKitData): Promise<void> {
  await fs.writeFile(MEDIAKIT_JSON_PATH, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

export async function publishMediaKitData(data: MediaKitData): Promise<void> {
  await fs.writeFile(MEDIAKIT_PUBLISHED_JSON_PATH, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

// Powers the public /mediakit page. Returns null until the first Publish —
// distinct from the draft in data/mediakit.json, which always exists.
export async function getPublishedMediaKitData(): Promise<MediaKitData | null> {
  try {
    const raw = await fs.readFile(MEDIAKIT_PUBLISHED_JSON_PATH, "utf-8");
    return JSON.parse(raw) as MediaKitData;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}
